const db = require('../db');
const uuid = require('uuid');
const validations = require('../validations');
const { DataTypes } = require('../classes/DataTypes')
const { event_emitter } = require('../event_emitter');
const { template_applications_forwarded_to } = require('../object_templates');
const { checkKeysExists } = require('../functions');

class Applications {
    name = 'Applications';
    description = 'Endpoints for creating/forwarding applications'
    data_types = {
        application_id: new DataTypes(true, ['applications/forward', 'applications/updateStatus'], ['applications/fetch']).uuid,
        application_title: new DataTypes(true, ['applications/create'], []).string,
        submitted_by: new DataTypes(true, [], ['applications/fetch']).uuid,
        submitted_to: new DataTypes(true, ['applications/create'], ['applications/fetch']).uuid,
        forwarded_to: new DataTypes(true, [], []).array,
        forward_to: new DataTypes(false, ['applications/forward'], []).uuid,
        status: new DataTypes(true, [], ['applications/updateStatus']).string,
        detail_structure: new DataTypes(true, ['applications/create'], []).json,
        remarks: new DataTypes(true, ['applications/updateStatus', 'applications/forward'], []).string,
        application_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
    }
}

function applicationsFetch(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new Applications, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    var where_clauses = []
    if (data.application_id) where_clauses.push(`application_id = '${data.application_id}'`)
    where_clauses.push(`(submitted_by = '${data.user_id}' OR submitted_to = '${data.user_id}' OR forwarded_to @> '[{"receiver_id": "${data.user_id}"}]')`)

    db.query(`
        SELECT * from applications
        ${where_clauses.length > 0 ? 'WHERE' : ''}
        ${where_clauses.join(' AND ')}
        ORDER BY application_creation_timestamp DESC;
        SELECT * FROM teachers t JOIN users u on u.user_id = t.teacher_id WHERE t.teacher_id IN (SELECT submitted_by FROM applications);
        SELECT * FROM students s JOIN users u on u.user_id = s.student_id JOIN students_batch sb on sb.student_id = s.student_id JOIN batches b on b.batch_id = sb.batch_id WHERE s.student_id IN (SELECT submitted_by FROM applications);
        SELECT * FROM users u WHERE u.user_type NOT IN ('student','teacher');
    `).then(res => {
        const applications = res[0].rows
        const users_list = []
        res[1].rows.concat(res[2].rows.concat(res[3].rows)).map(user => {
            users_list.push(
                user.user_type != 'student' && user.user_type != 'teacher' ? {
                    name: user.user_type,
                    user_id: user.user_id
                } : user.user_type == 'student' ?
                    Object.fromEntries(Object.entries(user).filter(([key]) => key == 'user_id' || key == 'student_name' || key == 'student_father_name' || key == 'student_gender' || key == 'reg_no' || key == 'batch_no' || key == 'degree_type'))
                    : user.user_type == 'teacher' ?
                        Object.fromEntries(Object.entries(user).filter(([key]) => key == 'user_id' || key == 'teacher_name' || key == 'teacher_gender' || key == 'reg_no')) : {}
            )
        })
        console.log(users_list)
        applications.map((application, index) => {
            applications[index].applicant_detail = users_list.filter(user => user.user_id == application.submitted_by)
        })
        return callback({ code: 200, status: 'OK', data: applications })
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function applicationsCreate(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new Applications, data.event)
    console.log(validator)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });
    const detailStructureValidator = validations.validateApplicationTemplateDetailStructure(data.detail_structure, { field_value_not_empty: true })
    if (!detailStructureValidator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: detailStructureValidator.message });

    db.query(`
        INSERT INTO applications (
            application_title,
            submitted_by,
            submitted_to,
            detail_structure
        ) VALUES (
            '${data.application_title}',
            '${data.user_id}',
            '${data.submitted_to}',
            '${JSON.stringify(data.detail_structure)}'
        )`
    ).then(res => {
        if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'added record to db' });
        else return callback({ code: 500, status: 'INTERNAL ERROR', message: 'database could not add record' });
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBInsertQueryError(err));
    })
}

function applicationsUpdateStatus(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new Applications, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        SELECT * FROM applications WHERE application_id = '${data.application_id}';
    `).then(res => {
        if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.application_id} does not exist` });

        const application = res.rows[0]

        if (application.submitted_to == data.user_id) {
            db.query(`
                UPDATE applications SET
                status = '${data.status}',
                remarks = '${data.remarks}',
                application_completion_timestamp = ${new Date().getTime()}
                WHERE application_id = '${data.application_id}';
            `).then(res => {
                if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `updated ${data.application_id} record in db` });
                else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.application_id} does not exist` });
                else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
            }).catch(err => {
                console.error(err)
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
                    return callback({ code: 500, status: 'INTERNAL ERROR', message: `Could not find a matching record of your request` });
                }
            } else {
                return callback({ code: 500, status: 'INTERNAL ERROR', message: `Could not find a matching record of your request` });
            }

            db.query(`
                UPDATE applications SET
                forwarded_to = '${JSON.stringify(application.forwarded_to)}'
                WHERE application_id = '${data.application_id}';
            `).then(res => {
                if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `updated ${data.application_id} record in db` });
                else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.application_id} does not exist` });
                else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
            }).catch(err => {
                console.error(err)
                return callback(validations.validateDBUpdateQueryError(err));
            })
        }
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBSelectQueryError(err));
    })

}

function applicationsForward(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new Applications, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        SELECT * FROM applications WHERE application_id = '${data.application_id}';
    `).then(res => {
        if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.application_id} does not exist` });

        const application = res.rows[0]

        const prev_forwarder = application.forwarded_to.pop()
        if (prev_forwarder) {
            if (prev_forwarder.receiver_id == data.user_id && prev_forwarder.status == 'under_review') {
                prev_forwarder.status = 'approved'
                prev_forwarder.completion_timestamp = new Date().getTime()
                application.forwarded_to.push(prev_forwarder)
            } else {
                if (application.submitted_to != data.user_id) {
                    return callback({ code: 500, status: 'INTERNAL ERROR', message: `Could not find a matching record of your request` });
                }
                application.forwarded_to.push(prev_forwarder)
            }
        } else {
            if (application.submitted_to != data.user_id) {
                return callback({ code: 500, status: 'INTERNAL ERROR', message: `Could not find a matching record of your request` });
            }
        }

        application.forwarded_to.push({
            sender_id: data.user_id,
            receiver_id: data.forward_to,
            sender_remarks: data.remarks,
            status: 'under_review',
            forward_timestamp: new Date().getTime(),
        })

        db.query(`
            UPDATE applications SET
            forwarded_to = '${JSON.stringify(application.forwarded_to)}'
            WHERE application_id = '${data.application_id}';
        `).then(res => {
            if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `updated ${data.application_id} record in db` });
            else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.application_id} does not exist` });
            else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
        }).catch(err => {
            console.error(err)
            return callback(validations.validateDBUpdateQueryError(err));
        })
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);

    if (notification.channel == 'applications_insert') {
        event_emitter.emit('notifyAll', { event: 'applications/listener/insert', data: payload })
    }
    if (notification.channel == 'applications_update') {
        event_emitter.emit('notifyAll', { event: 'applications/listener/update', data: payload[0] })
    }
    if (notification.channel == 'applications_delete') {
        event_emitter.emit('notifyAll', { event: 'applications/listener/delete', data: payload })
    }
})

module.exports = {
    applicationsCreate,
    applicationsFetch,
    applicationsUpdateStatus,
    applicationsForward,
    Applications
}