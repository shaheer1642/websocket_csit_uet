const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')

class Students {
    name = 'Students';
    description = 'Endpoints for creating student'
    data_types = {
        serial: new DataTypes(true).autonumber,
        student_id: new DataTypes(true,['students/update','students/delete'],['students/fetch']).uuid,
        cnic: new DataTypes(true,['students/create','students/update'],[]).string,
        reg_no: new DataTypes(true,[],['students/create','students/update']).string,
        student_name: new DataTypes(true,['students/create'],['students/update']).string,
        student_father_name: new DataTypes(true,[],['students/update','students/create']).string,
        student_address: new DataTypes(true,[],['students/update','students/create']).string,
        student_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
        user_id: new DataTypes(true).uuid,
        username: new DataTypes(true).string,
        password: new DataTypes(true).string,
        user_type: new DataTypes(true).string,
        batch_id: new DataTypes(true,['students/create','students/update'],['students/fetch']).uuid,
        batch_no: new DataTypes(true).string,
        joined_semester: new DataTypes(true).string,
        degree_type: new DataTypes(true).string,
    }
}

function studentsFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.batch_id)
            where_clauses.push(`batches.batch_id = '${data.batch_id}'`)
        if (data.student_id)
            where_clauses.push(`students.student_id = '${data.student_id}'`)
        db.query(`
            SELECT * FROM students
            JOIN students_batch on students_batch.student_id = students.student_id
            JOIN batches on batches.batch_id = students_batch.batch_id
            JOIN users ON users.user_id = students.student_id
            ${where_clauses.length > 0 ? 'WHERE':''}
            ${where_clauses.join(' AND ')}
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: res.rows
            })
        }).catch(err => {
            console.log(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

function studentsCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        if (!data.cnic && !data.reg_no) {
            if (callback) {
                callback({
                    code: 400, 
                    status: 'BAD REQUEST',
                    message: 'Both CNIC and Reg No cannot be empty'
                });
            }
            return
        }
        db.query(`
            WITH query_one AS ( 
                INSERT INTO users (username, user_type) 
                VALUES (
                    '${data.cnic || data.reg_no}',
                    'student'
                ) 
                RETURNING user_id 
            ), query_two AS (
                INSERT INTO students (student_id, cnic, reg_no, student_name, student_father_name, student_address) 
                VALUES (
                    ( select user_id from query_one ),
                    ${data.cnic ? `'${data.cnic}'`:null},
                    ${data.reg_no ? `'${data.reg_no}'`:null},
                    '${data.student_name}',
                    ${data.student_father_name ? `'${data.student_father_name}'`:null},
                    ${data.student_address ? `'${data.student_address}'`:null}
                )
            )
            INSERT INTO students_batch (student_id, batch_id)
            VALUES (
                ( select user_id from query_one ),
                '${data.batch_id}'
            );
        `).then(res => {
            if (!callback) return
            if (res.rowCount == 1) {
                callback({
                    code: 200, 
                    status: 'OK',
                    message: 'added record to db'
                });
            } else {
                callback({
                    code: 500, 
                    status: 'INTERNAL ERROR',
                    message: 'unexpected DB response'
                });
            }
        }).catch(err => {
            console.log(err)
            if (callback) {
                callback(validations.validateDBInsertQueryError(err));
            }
        })
    }
}

function studentsDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        db.query(`
            DELETE FROM users WHERE user_id='${data.student_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `deleted ${data.student_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.student_id} does not exist`
                    });
                }
            } else {
                if (callback) {
                    callback({
                        code: 500, 
                        status: 'INTERNAL ERROR',
                        message: `${res.rowCount} rows deleted`
                    });
                }
            }
        }).catch(err => {
            console.log(err)
            if (callback) {
                callback(validations.validateDBDeleteQueryError(err));
            }
        })
    }
}

function studentsUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
        return
    } else {
        var update_clauses = []
        if (data.student_name) update_clauses.push(`student_name = '${data.student_name}'`)
        if (data.cnic) update_clauses.push(`cnic = '${data.cnic}'`)
        if (data.reg_no) update_clauses.push(`reg_no = '${data.reg_no}'`)
        if (data.student_father_name) update_clauses.push(`student_father_name = '${data.student_father_name}'`)
        if (data.student_address) update_clauses.push(`student_address = '${data.student_address}'`)
        if (update_clauses.length == 0) {
            if (callback) {
                callback({
                    code: 400, 
                    status: 'BAD REQUEST',
                    message: `No valid parameters found in requested data.`,
                });
            }
            return
        }
        db.query(`
            UPDATE students SET
            ${update_clauses.join(',')}
            WHERE student_id = '${data.student_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated ${data.student_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.student_id} does not exist`
                    });
                }
            } else {
                if (callback) {
                    callback({
                        code: 500, 
                        status: 'INTERNAL ERROR',
                        message: `${res.rowCount} rows updated`
                    });
                }
            }
        }).catch(err => {
            console.log(err)
            if (callback) {
                callback(validations.validateDBUpdateQueryError(err));
            }
        })
    }
}

module.exports = {
    studentsFetch,
    studentsCreate,
    studentsDelete,
    studentsUpdate,
    Students
}