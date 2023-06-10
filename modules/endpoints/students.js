const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class Students {
    name = 'Students';
    description = 'Endpoints for creating student'
    data_types = {
        serial: new DataTypes(true).autonumber,
        student_id: new DataTypes(true,['students/update','students/delete'],['students/fetch']).uuid,
        cnic: new DataTypes(true,[],['students/create','students/update'],false,'1730155555555').string,
        reg_no: new DataTypes(true,[],['students/create','students/update'],false,'19pwbcs0000').string,
        student_name: new DataTypes(true,['students/create'],['students/update']).string,
        student_father_name: new DataTypes(true,['students/create'],['students/update']).string,
        student_gender: new DataTypes(true,['students/create'],['students/update'],false,'male').string,
        user_email: new DataTypes(true,[],['students/update','students/create']).email,
        student_address: new DataTypes(true,[],['students/update','students/create'],false,'street#5, abc road, abc area, xyz city').string,
        student_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
        user_id: new DataTypes(true).uuid,
        username: new DataTypes(true).string,
        password: new DataTypes(true).string,
        user_type: new DataTypes(true).string,
        student_batch_id: new DataTypes(true,['students/freezeSemester']).uuid,
        batch_id: new DataTypes(true,['students/create','students/update','students/delete'],['students/fetch']).uuid,
        batch_no: new DataTypes(true).string,
        joined_semester: new DataTypes(true).string,
        degree_type: new DataTypes(true).string,
        semester_frozen: new DataTypes(true).boolean,
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
        if (data.batch_id) where_clauses.push(`batches.batch_id = '${data.batch_id}'`)
        if (data.student_id) where_clauses.push(`students.student_id = '${data.student_id}'`)
        if (data.reg_no) where_clauses.push(`students.reg_no = '${data.reg_no}'`)
        if (data.cnic) where_clauses.push(`students.cnic = '${data.cnic}'`)
        
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
            console.error(err)
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
        if (!data.cnic && !data.reg_no) return callback({ code: 400, status: 'BAD REQUEST', message: 'Both CNIC and Reg No cannot be empty' });
        data.cnic = data.cnic?.toLowerCase()
        data.reg_no = data.reg_no?.toLowerCase()
        db.query(`
            WITH query_one AS ( 
                INSERT INTO users (username, user_type, user_email) 
                VALUES (
                    '${data.reg_no || data.cnic}',
                    'student',
                    ${data.user_email ? `'${data.user_email}'` : null}
                ) 
                RETURNING user_id 
            ), query_two AS (
                INSERT INTO students (student_id, cnic, reg_no, student_name, student_father_name, student_gender, student_address) 
                VALUES (
                    ( select user_id from query_one ),
                    ${data.cnic ? `'${data.cnic}'`:null},
                    ${data.reg_no ? `'${data.reg_no}'`:null},
                    '${data.student_name}',
                    '${data.student_father_name}',
                    '${data.student_gender.toLowerCase()}',
                    ${data.student_address ? `'${data.student_address}'` : null}
                )
            )
            INSERT INTO students_batch (student_id, batch_id)
            VALUES (
                ( select user_id from query_one ),
                '${data.batch_id}'
            );
        `).then(res => {
            if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'added record to db' });
            else return callback({ code: 500, status: 'INTERNAL ERROR', message: 'unexpected DB response' });
        }).catch(err => {
            if (err.code == '23505' && (err.constraint == 'students_cinc_ukey' || err.constraint == 'students_regno_ukey')) {
                db.query(`
                    INSERT INTO students_batch (student_id, batch_id)
                    VALUES (
                        ( select student_id from students WHERE cnic = '${data.cnic}' OR reg_no = '${data.reg_no}'),
                        '${data.batch_id}'
                    );
                `).then(res => {
                    if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'added record to db' });
                    else return callback({ code: 500, status: 'INTERNAL ERROR', message: 'unexpected DB response' });
                }).catch(err => {
                    console.error(err)
                    return callback(validations.validateDBInsertQueryError(err));
                })
            } else {
                console.error(err)
                return callback(validations.validateDBInsertQueryError(err));
            }
        })
    }
}

function studentsDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        SELECT * FROM students_batch WHERE student_id = '${data.student_id}';
    `).then(res => {
        if (res.rowCount == 1 && res.rows.some(row => row.batch_id == data.batch_id)) {
            db.query(`
                DELETE FROM users WHERE user_id='${data.student_id}';
            `).then(res => {
                if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `deleted ${data.student_id} record from db` });
                else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.student_id} does not exist` });
                else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows deleted` });
            }).catch(err => {
                console.error(err)
                return callback(validations.validateDBDeleteQueryError(err));
            })
        } else if (res.rowCount > 1) {
            db.query(`
                DELETE FROM students_batch WHERE student_id='${data.student_id}' AND batch_id='${data.batch_id}';
            `).then(res => {
                if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `deleted student_id=${data.student_id} batch_id=${data.batch_id} record from db` });
                else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record student_id=${data.student_id} batch_id=${data.batch_id} does not exist` });
                else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows deleted` });
            }).catch(err => {
                console.error(err)
                return callback(validations.validateDBDeleteQueryError(err));
            })
        } else return callback({ code: 500, status: 'INTERNAL ERROR', message: `Could not find that user` });
    }).catch(err => {
        console.error(err)
        if (callback) {
            callback(validations.validateDBDeleteQueryError(err));
        }
    })
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
        if (data.student_gender) update_clauses.push(`student_gender = '${data.student_gender}'`)
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
        db.query(
            data.cnic || data.reg_no ?
            `WITH query_one AS ( 
                UPDATE students SET
                ${update_clauses.join(',')}
                WHERE student_id = '${data.student_id}'
                RETURNING reg_no, cnic
            )
            UPDATE users SET 
            username = ( select COALESCE(reg_no, cnic) from query_one ) 
            ${data.user_email ? `,user_email = '${data.user_email}'`:''} 
            WHERE user_id = '${data.student_id}';`
            :
            `UPDATE students SET
            ${update_clauses.join(',')}
            WHERE student_id = '${data.student_id}';`
        ).then(res => {
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
            console.error(err)
            if (callback) {
                callback(validations.validateDBUpdateQueryError(err));
            }
        })
    }
}

function studentsFreezeSemester(data,callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        UPDATE students_batch SET
        semester_frozen = ${data.semester_frozen}
        WHERE student_batch_id = '${data.student_batch_id}';
    `).then(res => {
        if (res.rowCount == 1) callback({ code: 200, status: 'OK', message: `updated record in db` });
        else if (res.rowCount == 0) callback({ code: 400, status: 'BAD REQUEST', message: `record does not exist` }); 
        else callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
    }).catch(err => {
        console.error(err)
        callback(validations.validateDBUpdateQueryError(err));
    })
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);
    
    if (notification.channel == 'students_insert') {
        db.query(`
            SELECT * FROM students
            JOIN students_batch on students_batch.student_id = students.student_id
            JOIN batches on batches.batch_id = students_batch.batch_id
            JOIN users ON users.user_id = students.student_id
            WHERE students.student_id = '${payload.student_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                event_emitter.emit('notifyAll', {event: 'students/listener/insert', data: res.rows[0]})
            }
        }).catch(console.error)
    }
    if (notification.channel == 'students_update') {
        db.query(`
            SELECT * FROM students
            JOIN students_batch on students_batch.student_id = students.student_id
            JOIN batches on batches.batch_id = students_batch.batch_id
            JOIN users ON users.user_id = students.student_id
            WHERE students.student_id = '${payload[0].student_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                event_emitter.emit('notifyAll', {event: 'students/listener/update', data: res.rows[0]})
            }
        }).catch(console.error)
    }
    if (notification.channel == 'students_delete') {
        event_emitter.emit('notifyAll', {event: 'students/listener/delete', data: payload})
    }

    if (notification.channel == 'students_batch_insert') {
        event_emitter.emit('notifyAll', {event: 'studentsBatch/listener/insert', data: payload})
    }
    if (notification.channel == 'students_batch_update') {
        event_emitter.emit('notifyAll', {event: 'studentsBatch/listener/update', data: payload[0]})
    }
    if (notification.channel == 'students_batch_delete') {
        event_emitter.emit('notifyAll', {event: 'studentsBatch/listener/delete', data: payload})
    }
})

module.exports = {
    studentsFetch,
    studentsCreate,
    studentsDelete,
    studentsUpdate,
    studentsFreezeSemester,
    Students
}