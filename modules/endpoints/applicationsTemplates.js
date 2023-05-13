const {db} = require('../db_connection');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes');
const { event_emitter } = require('../event_emitter');

class ApplicationsTemplates {
    name = 'Applications Templates';
    description = 'Endpoints for creating/fetching applications templates'
    data_types = {
        template_id: new DataTypes(true,['applicationsTemplates/update','applicationsTemplates/delete'],['applicationsTemplates/fetch']).uuid,
        application_title: new DataTypes(true,['applicationsTemplates/create'],['applicationsTemplates/update']).string,
        detail_structure: new DataTypes(true,['applicationsTemplates/create'],['applicationsTemplates/update']).json,
        degree_type: new DataTypes(true,[],['applicationsTemplates/create','applicationsTemplates/update']).string,
        submit_to: new DataTypes(true,[],['applicationsTemplates/create','applicationsTemplates/update']).uuid,
    }
}

function applicationsTemplatesFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new ApplicationsTemplates,data.event)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});

    var where_clauses = []
    if (data.template_id) where_clauses.push(`template_id = '${data.template_id}'`)
    if (data.degree_type) where_clauses.push(`degree_type = '${data.degree_type}'`)
    if (data.submit_to) where_clauses.push(`submit_to = '${data.submit_to}'`)

    db.query(`
        SELECT * from applications_templates
        ${where_clauses.length > 0 ? 'WHERE':''}
        ${where_clauses.join(' AND ')}
        ORDER BY application_title;
    `).then(res => {
        return callback({code: 200, status: 'OK', data: res.rows})
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function validateDetailStructure(detail_structure) {
    if (Object.values(detail_structure).length == 0) return {valid: false, message: 'Detail structure cannot be empty'};
    [{"required": true, "field_name": "", "field_type": "", "multi_line": false, "placeholder": ""}]
    if (detail_structure.some(o => o.field_name == '')) return {valid: false, message: 'Detail structure field_name cannot be empty'};
    if (detail_structure.some(o => o.field_type == '')) return {valid: false, message: 'Detail structure field_type cannot be empty'};
    return {valid: true};
}

function applicationsTemplatesCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new ApplicationsTemplates,data.event)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});
    const detailStructureValidator = validateDetailStructure(data.detail_structure)
    if (!detailStructureValidator.valid) return callback({code: 400, status: 'BAD REQUEST', message: detailStructureValidator.message});
    
    db.query(`INSERT INTO applications_templates (
        application_title,
        detail_structure
        ${data.degree_type ? ',degree_type': ''}
        ${data.submit_to ? ',submit_to': ''}
    ) VALUES (
        '${data.application_title}',
        '${JSON.stringify(data.detail_structure)}'
        ${data.degree_type ? `,'${data.degree_type}'`:''}
        ${data.submit_to ? `,'${data.submit_to}'`:''}
    )`).then(res => {
        if (res.rowCount == 1) return callback({code: 200, status: 'OK', message: 'added record to db'});
        else return callback({code: 500, status: 'INTERNAL ERROR', message: 'database could not add record'});
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBInsertQueryError(err));
    })
}

function applicationsTemplatesUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new ApplicationsTemplates,data.event)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});
    if (data.detail_structure) {
        const detailStructureValidator = validateDetailStructure(data.detail_structure)
        if (!detailStructureValidator.valid) return callback({code: 400, status: 'BAD REQUEST', message: detailStructureValidator.message});
    }

    var update_clauses = []
    if (data.application_title) update_clauses.push(`application_title = '${data.application_title}'`)
    if (data.detail_structure) update_clauses.push(`detail_structure = '${JSON.stringify(data.detail_structure)}'`)
    if (data.degree_type != undefined) update_clauses.push(`degree_type = ${data.degree_type == '' ? 'NULL' : `'${data.degree_type}'`}`)
    if (data.submit_to != undefined) update_clauses.push(`submit_to = ${data.submit_to == '' ? 'NULL' : `'${data.submit_to}'`}`)
    if (update_clauses.length == 0) return callback({code: 400, status: 'BAD REQUEST', message: `No valid parameters found in requested data.`});

    db.query(`
        UPDATE applications_templates SET
        ${update_clauses.join(',')}
        WHERE template_id = '${data.template_id}';
    `).then(res => {
        if (res.rowCount == 1) return callback({code: 200, status: 'OK', message: `updated ${data.template_id} record in db`});
        else if (res.rowCount == 0) return callback({code: 400, status: 'BAD REQUEST', message: `record ${data.template_id} does not exist`});
        else return callback({code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated`});
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBUpdateQueryError(err));
    })
}

function applicationsTemplatesDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new ApplicationsTemplates,data.event)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});
    
    db.query(`DELETE FROM applications_templates WHERE template_id = '${data.template_id}'`)
    .then(res => {
        if (res.rowCount == 1) return callback({code: 200, status: 'OK', message: 'deleted record from db'});
        else return callback({code: 400, status: 'BAD REQUEST', message: 'record does not exist'});
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBDeleteQueryError(err));
    })
}

db.on('notification', (notification) => {
    if (['applications_templates_insert','applications_templates_update','applications_templates_delete'].includes(notification.channel)) {
        event_emitter.emit('notifyAll', {event: 'applicationsTemplates/listener/changed', data: undefined})
    }
})

module.exports = {
    applicationsTemplatesFetch,
    applicationsTemplatesCreate,
    applicationsTemplatesUpdate,
    applicationsTemplatesDelete,
    ApplicationsTemplates
}