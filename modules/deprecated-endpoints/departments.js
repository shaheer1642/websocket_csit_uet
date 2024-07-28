const db = require('../db');
const validations = require('../validations');
const { DataTypes } = require('../classes/DataTypes')

class Departments {
    name = 'Departments';
    description = 'Endpoints for creating student batches'
    data_types = {
        serial: new DataTypes(true).autonumber,
        department_id: new DataTypes(true, ['departments/updateChairman'], ['departments/fetch'], false, 'CS&IT').string,
        department_name: new DataTypes(true, [], [], false, 'Computer Science & Information Technology').string,
        chairman_id: new DataTypes(true, ['departments/updateChairman'], []).uuid,
    }
}

function departmentsFetch(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new Departments, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        SELECT * FROM departments
        ${data.department_id ? ` WHERE department_id = '${data.department_id}'` : ''}
        ORDER BY serial ASC;
    `).then(res => {
        return callback({ code: 200, status: 'OK', data: res.rows })
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function departmentsUpdateChairman(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new Departments, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        UPDATE departments SET
        chairman_id = ${data.chairman_id ? `'${data.chairman_id}'` : 'NULL'}
        WHERE department_id = '${data.department_id}';
    `).then(res => {
        if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `updated ${data.department_id} record in db` });
        else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.department_id} does not exist` });
        else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBUpdateQueryError(err));
    })
}

module.exports = {
    departmentsFetch,
    departmentsUpdateChairman,
    Departments
}