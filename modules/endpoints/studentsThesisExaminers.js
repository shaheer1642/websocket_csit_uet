const db = require('../db');
const validations = require('../validations');
const { DataTypes } = require('../classes/DataTypes')

class StudentsThesisExaminers {
    name = 'Students Thesis Examiners';
    description = 'Endpoints for managing students thesis examiners'
    data_types = {
        examiner_id: new DataTypes(true, ['studentsThesisExaminers/update', 'studentsThesisExaminers/delete'], ['studentsThesisExaminers/fetch']).uuid,
        examiner_name: new DataTypes(true, ['studentsThesisExaminers/create'], []).string,
        examiner_university: new DataTypes(true, [], ['studentsThesisExaminers/create', 'studentsThesisExaminers/update']).string,
        examiner_designation: new DataTypes(true, [], ['studentsThesisExaminers/create', 'studentsThesisExaminers/update']).string,
        examiner_type: new DataTypes(true, ['studentsThesisExaminers/create'], ['studentsThesisExaminers/fetch']).string,
        examiner_creation_timestamp: new DataTypes(true, [], []).string,
    }
}

function studentsThesisExaminersFetch(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new StudentsThesisExaminers, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    var where_clauses = []
    if (data.examiner_id) where_clauses.push(`STE.examiner_id = '${data.examiner_id}'`)
    if (data.examiner_type) where_clauses.push(`STE.examiner_type = '${data.examiner_type}'`)

    db.query(`
        SELECT * FROM students_thesis_examiners STE
        ${where_clauses.length > 0 ? 'WHERE' : ''}
        ${where_clauses.join(' AND ')}
        ORDER BY STE.examiner_creation_timestamp DESC;
    `).then(res => {
        return callback({ code: 200, status: 'OK', data: res.rows })
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function studentsThesisExaminersCreate(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new StudentsThesisExaminers, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        INSERT INTO students_thesis_examiners (examiner_name, examiner_university, examiner_designation, examiner_type)
        VALUES (
            '${data.examiner_name}',
            ${data.examiner_university ? `'${data.examiner_university}'` : 'NULL'},
            ${data.examiner_designation ? `'${data.examiner_designation}'` : 'NULL'},
            '${data.examiner_type}'
        );
    `).then(res => {
        if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'added record to db' });
        else return callback({ code: 500, status: 'INTERNAL ERROR', message: 'unexpected DB response' });
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBInsertQueryError(err));
    })
}

function studentsThesisExaminersUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new StudentsThesisExaminers, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    var update_clauses = []
    if (data.examiner_designation) update_clauses.push(`examiner_designation = '${data.examiner_designation}'`)
    if (data.examiner_university) update_clauses.push(`examiner_university = '${data.examiner_university}'`)
    if (update_clauses.length == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `No valid parameters found in requested data.` });

    db.query(`
        UPDATE students_thesis_examiners SET
        ${update_clauses.join(',')}
        WHERE examiner_id = '${data.examiner_id}';
    `).then(res => {
        if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `updated ${data.examiner_id} record in db` });
        else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.examiner_id} does not exist` });
        else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBUpdateQueryError(err));
    })
}

function studentsThesisExaminersDelete(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new StudentsThesisExaminers, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        DELETE FROM students_thesis_examiners WHERE examiner_id='${data.examiner_id}';
    `).then(res => {
        if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `deleted ${data.examiner_id} record from db` });
        else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.examiner_id} does not exist` });
        else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows deleted` });
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBDeleteQueryError(err));
    })
}

module.exports = {
    studentsThesisExaminersFetch,
    studentsThesisExaminersCreate,
    studentsThesisExaminersUpdate,
    studentsThesisExaminersDelete,
    StudentsThesisExaminers
}