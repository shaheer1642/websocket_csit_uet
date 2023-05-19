const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter');
const { template_applications_forwarded_to } = require('../object_templates');
const { checkKeysExists } = require('../functions');

class Applications {
    name = 'Applications';
    description = 'Endpoints for creating/forwarding applications'
    data_types = {
        application_id: new DataTypes(true,['applications/forward','applications/updateStatus'],['applications/fetch']).uuid,
        application_title: new DataTypes(true,['applications/create'],[]).string,
        submitted_by: new DataTypes(true,['applications/create'],['applications/fetch']).uuid,
        submitted_to: new DataTypes(true,['applications/create'],['applications/fetch']).uuid,
        forwarded_to: new DataTypes(true,['applications/forward'],['applications/create']).json,
        forwarded_to_user_id: new DataTypes(false,[],['applications/fetch']).uuid,
        status: new DataTypes(true,[],['applications/updateStatus']).string,
        detail_structure: new DataTypes(true,['applications/create'],[]).json,
        remarks: new DataTypes(true,['applications/updateStatus'],[]).string,
        application_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
    }
}

function applicationsFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Applications,data.event)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});

    var where_clauses = []
    if (data.application_id) where_clauses.push(`application_id = '${data.application_id}'`)
    if (data.user_id) where_clauses.push(`(submitted_by = '${data.user_id}' OR submitted_to = '${data.user_id}' OR forwarded_to @> '[{"receiver_id": "${data.user_id}"}]')`)

    db.query(`
        SELECT * from applications
        ${where_clauses.length > 0 ? 'WHERE':''}
        ${where_clauses.join(' AND ')}
        ORDER BY application_creation_timestamp DESC;
    `).then(res => {
        return callback({code: 200, status: 'OK', data: res.rows})
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function applicationsCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Applications,data.event)
    console.log(validator)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});
    const detailStructureValidator = validations.validateApplicationTemplateDetailStructure(data.detail_structure, {field_value_not_empty: true})
    if (!detailStructureValidator.valid) return callback({code: 400, status: 'BAD REQUEST', message: detailStructureValidator.message});

    db.query(`INSERT INTO applications (
        application_title,
        submitted_by,
        submitted_to,
        detail_structure
    ) VALUES (
        '${data.application_title}',
        '${data.submitted_by}',
        '${data.submitted_to}',
        '${JSON.stringify(data.detail_structure)}'
    )`).then(res => {
        if (res.rowCount == 1) return callback({code: 200, status: 'OK', message: 'added record to db'});
        else return callback({code: 500, status: 'INTERNAL ERROR', message: 'database could not add record'});
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBInsertQueryError(err));
    })
}

function applicationsUpdateStatus(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Applications,data.event)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});

    db.query(`
        SELECT * FROM applications WHERE application_id = '${data.application_id}';
    `).then(res => {
        if (res.rowCount == 0) return callback({code: 400, status: 'BAD REQUEST', message: `record ${data.application_id} does not exist`});

        const application = res.rows[0]

        if (application.submitted_to == data.user_id) {
            db.query(`
                UPDATE applications SET
                status = '${data.status}',
                remarks = '${data.remarks}',
                application_completion_timestamp = ${new Date().getTime()}
                WHERE application_id = '${data.application_id}';
            `).then(res => {
                if (res.rowCount == 1) return callback({code: 200, status: 'OK', message: `updated ${data.application_id} record in db`});
                else if (res.rowCount == 0) return callback({code: 400, status: 'BAD REQUEST', message: `record ${data.application_id} does not exist`});
                else return callback({code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated`});
            }).catch(err => {
                console.log(err)
                return callback(validations.validateDBUpdateQueryError(err));
            })
        } else {
            const prev_forwarder = application.forwarded_to.pop()
            console.log(prev_forwarder)
            if (prev_forwarder) {
                if (prev_forwarder.receiver_id == data.user_id && prev_forwarder.status == 'under_review') {
                    prev_forwarder.status = data.status
                    prev_forwarder.receiver_remarks = data.remarks
                    prev_forwarder.completion_timestamp = new Date().getTime()
                    application.forwarded_to.push(prev_forwarder)
                } else {
                    return callback({code: 500, status: 'INTERNAL ERROR', message: `Could not find a matching record of your request`});
                }
            } else {
                return callback({code: 500, status: 'INTERNAL ERROR', message: `Could not find a matching record of your request`});
            }
    
            db.query(`
                UPDATE applications SET
                forwarded_to = '${JSON.stringify(application.forwarded_to)}'
                WHERE application_id = '${data.application_id}';
            `).then(res => {
                if (res.rowCount == 1) return callback({code: 200, status: 'OK', message: `updated ${data.application_id} record in db`});
                else if (res.rowCount == 0) return callback({code: 400, status: 'BAD REQUEST', message: `record ${data.application_id} does not exist`});
                else return callback({code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated`});
            }).catch(err => {
                console.log(err)
                return callback(validations.validateDBUpdateQueryError(err));
            })
        }
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBSelectQueryError(err));
    })

}

function applicationsForward(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Applications,data.event)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});
    const forwardedToValidator = validations.validateApplicationForwardedTo(data.forwarded_to)
    if (!forwardedToValidator.valid) return callback({code: 400, status: 'BAD REQUEST', message: forwardedToValidator.message});
    
    db.query(`
        SELECT * FROM applications WHERE application_id = '${data.application_id}';
    `).then(res => {
        if (res.rowCount == 0) return callback({code: 400, status: 'BAD REQUEST', message: `record ${data.application_id} does not exist`});

        const application = res.rows[0]

        const prev_forwarder = application.forwarded_to.pop()
        if (prev_forwarder) {
            if (prev_forwarder.receiver_id == data.forwarded_to.sender_id && prev_forwarder.status == 'under_review') {
                prev_forwarder.status = 'completed'
                prev_forwarder.completion_timestamp = new Date().getTime()
                application.forwarded_to.push(prev_forwarder)
            } else {
                return callback({code: 500, status: 'INTERNAL ERROR', message: `Could not find a matching record of your request`});
            }
        } else {
            if (application.submitted_to != data.forwarded_to.sender_id) {
                return callback({code: 500, status: 'INTERNAL ERROR', message: `Could not find a matching record of your request`});
            }
        }

        application.forwarded_to.push({
            ...data.forwarded_to,
            status: 'under_review',
            forward_timestamp: new Date().getTime(),
        })

        db.query(`
            UPDATE applications SET
            forwarded_to = '${JSON.stringify(application.forwarded_to)}'
            WHERE application_id = '${data.application_id}';
        `).then(res => {
            if (res.rowCount == 1) return callback({code: 200, status: 'OK', message: `updated ${data.application_id} record in db`});
            else if (res.rowCount == 0) return callback({code: 400, status: 'BAD REQUEST', message: `record ${data.application_id} does not exist`});
            else return callback({code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated`});
        }).catch(err => {
            console.log(err)
            return callback(validations.validateDBUpdateQueryError(err));
        })
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);
    
    if (notification.channel == 'applications_insert') {
        event_emitter.emit('notifyAll', {event: 'applications/listener/insert', data: payload})
    }
    if (notification.channel == 'applications_update') {
        event_emitter.emit('notifyAll', {event: 'applications/listener/update', data: payload[0]})
    }
    if (notification.channel == 'applications_delete') {
        event_emitter.emit('notifyAll', {event: 'applications/listener/delete', data: payload})
    }
})

module.exports = {
    applicationsCreate,
    applicationsFetch,
    applicationsUpdateStatus,
    applicationsForward,
    Applications
}