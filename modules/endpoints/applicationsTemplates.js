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
        detail_structure: new DataTypes(true,['applicationsTemplates/create'],['applicationsTemplates/update']).array,
        degree_type: new DataTypes(true,[],['applicationsTemplates/create','applicationsTemplates/update']).string,
        submit_to: new DataTypes(true,[],['applicationsTemplates/create','applicationsTemplates/update']).uuid,
        visibility: new DataTypes(true,['applicationsTemplates/create'],['applicationsTemplates/update']).array,
        restrict_visibility: new DataTypes(true,[],['applicationsTemplates/fetch']).boolean,
    }
}

function applicationsTemplatesFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new ApplicationsTemplates,data.event)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});

    var where_clauses = []
    if (data.template_id) where_clauses.push(`template_id = '${data.template_id}'`)
    if (data.user_id && (data.restrict_visibility == undefined || data.restrict_visibility == true)) where_clauses.push(`visibility @> to_jsonb((SELECT user_type FROM users WHERE user_id = '${data.user_id}')::text)`)

    db.query(`
        SELECT * FROM students s JOIN students_batch sb on sb.student_id = s.student_id JOIN batches b on b.batch_id = sb.batch_id WHERE s.student_id = '${data.user_id}';
        SELECT * from applications_templates
        ${where_clauses.length > 0 ? 'WHERE':''}
        ${where_clauses.join(' AND ')}
        ORDER BY application_title;
    `).then(res => {
        const user = res[0].rows[0]
        var templates = res[1].rows
        if (user) templates = templates.filter(template => !template.degree_type || template.degree_type == user.degree_type)
        return callback({code: 200, status: 'OK', data: templates})
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function applicationsTemplatesCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new ApplicationsTemplates,data.event)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});
    const detailStructureValidator = validations.validateApplicationTemplateDetailStructure(data.detail_structure)
    if (!detailStructureValidator.valid) return callback({code: 400, status: 'BAD REQUEST', message: detailStructureValidator.message});
    
    db.query(`INSERT INTO applications_templates (
        application_title,
        detail_structure,
        visibility
        ${data.degree_type ? ',degree_type': ''}
        ${data.submit_to ? ',submit_to': ''}
    ) VALUES (
        '${data.application_title}',
        '${JSON.stringify(data.detail_structure)}',
        '${JSON.stringify(data.visibility)}'
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
        const detailStructureValidator = validations.validateApplicationTemplateDetailStructure(data.detail_structure)
        if (!detailStructureValidator.valid) return callback({code: 400, status: 'BAD REQUEST', message: detailStructureValidator.message});
    }

    var update_clauses = []
    if (data.application_title) update_clauses.push(`application_title = '${data.application_title}'`)
    if (data.detail_structure) update_clauses.push(`detail_structure = '${JSON.stringify(data.detail_structure)}'`)
    if (data.visibility) update_clauses.push(`visibility = '${JSON.stringify(data.visibility)}'`)
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