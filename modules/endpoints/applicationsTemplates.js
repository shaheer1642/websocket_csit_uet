const {db} = require('../db_connection');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')

class ApplicationsTemplates {
    name = 'Applications Templates';
    description = 'Endpoints for creating/fetching applications templates'
    data_types = {
        template_id: new DataTypes(true,['applicationsTemplates/delete'],['applicationsTemplates/fetch']).uuid,
        detail_structure: new DataTypes(true,['applicationsTemplates/create'],[]).json,
        degree_type: new DataTypes(true,['applicationsTemplates/create'],[]).string,
        submit_to: new DataTypes(true,[],['applicationsTemplates/create']).uuid,
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
        ORDER BY application_creation_timestamp DESC;
    `).then(res => {
        return callback({code: 200, status: 'OK', data: res.rows})
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function applicationsTemplatesCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new ApplicationsTemplates,data.event)
    if (!validator.valid) return callback({code: 400, status: 'BAD REQUEST', message: validator.reason});
    
    db.query(`INSERT INTO applications_templates (
        detail_structure,
        degree_type
        submit_to
        ${data.submit_to ? ',submit_to': ''}
    ) VALUES (
        '${JSON.stringify(data.detail)}',
        '${data.degree_type}'
        ${data.submit_to ? `,'${data.submit_to}'`:''}
    )`).then(res => {
        if (res.rowCount == 1) return callback({code: 200, status: 'OK', message: 'added record to db'});
        else return callback({code: 500, status: 'INTERNAL ERROR', message: 'database could not add record'});
    }).catch(err => {
        console.log(err)
        return callback(validations.validateDBInsertQueryError(err));
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

module.exports = {
    applicationsTemplatesFetch,
    applicationsTemplatesCreate,
    applicationsTemplatesDelete,
    ApplicationsTemplates
}