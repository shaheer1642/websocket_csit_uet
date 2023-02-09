const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class Teachers {
    name = 'Teachers';
    description = 'Endpoints for creating teacher'
    data_types = {
        teacher_id: new DataTypes(true,['teachers/update','teachers/delete'],['teachers/fetch']).uuid,
        cnic: new DataTypes(true,[],['teachers/create','teachers/update'],false,'1730155555555').string,
        reg_no: new DataTypes(true,[],['teachers/create','teachers/update'],false,'19pwbcs0000').string,
        teacher_name: new DataTypes(true,['teachers/create'],['teachers/update']).string,
        teacher_gender: new DataTypes(true,['teachers/create'],['teachers/update'],false,'male').string,
        teacher_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
        user_id: new DataTypes(true).uuid,
        username: new DataTypes(true).string,
        password: new DataTypes(true).string,
        user_type: new DataTypes(true).string,
    }
}

function teachersFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Teachers,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.teacher_id)
            where_clauses.push(`teachers.teacher_id = '${data.teacher_id}'`)
        db.query(`
            SELECT * FROM teachers
            JOIN users ON users.user_id = teachers.teacher_id
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

function teachersCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Teachers,data.event)
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
                    'teacher'
                ) 
                RETURNING user_id 
            )
            INSERT INTO teachers (teacher_id, cnic, reg_no, teacher_name, teacher_gender) 
            VALUES (
                ( select user_id from query_one ),
                ${data.cnic ? `'${data.cnic}'`:null},
                ${data.reg_no ? `'${data.reg_no}'`:null},
                '${data.teacher_name}',
                '${data.teacher_gender}'
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

function teachersDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Teachers,data.event)
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
            DELETE FROM users WHERE user_id='${data.teacher_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `deleted ${data.teacher_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.teacher_id} does not exist`
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

function teachersUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Teachers,data.event)
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
        if (data.teacher_name) update_clauses.push(`teacher_name = '${data.teacher_name}'`)
        if (data.teacher_gender) update_clauses.push(`teacher_gender = '${data.teacher_gender}'`)
        if (data.cnic) update_clauses.push(`cnic = '${data.cnic}'`)
        if (data.reg_no) update_clauses.push(`reg_no = '${data.reg_no}'`)
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
            WITH query_one AS ( 
                UPDATE teachers SET
                ${update_clauses.join(',')}
                WHERE teacher_id = '${data.teacher_id}'
                RETURNING cnic, reg_no
            )
            UPDATE users SET username = ( select COALESCE(cnic, reg_no) from query_one ) WHERE user_id = '${data.teacher_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated ${data.teacher_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.teacher_id} does not exist`
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

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);
    
    if (notification.channel == 'teachers_insert') {
        db.query(`
            SELECT * FROM teachers
            JOIN users ON users.user_id = teachers.teacher_id
            WHERE teachers.teacher_id = '${payload.teacher_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                event_emitter.emit('notifyAll', {event: 'teachers/listener/insert', data: res.rows[0]})
            }
        }).catch(console.error)
    }
    if (notification.channel == 'teachers_update') {
        db.query(`
            SELECT * FROM teachers
            JOIN users ON users.user_id = teachers.teacher_id
            WHERE teachers.teacher_id = '${payload[0].teacher_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                event_emitter.emit('notifyAll', {event: 'teachers/listener/update', data: res.rows[0]})
            }
        }).catch(console.error)
    }
    if (notification.channel == 'teachers_delete') {
        event_emitter.emit('notifyAll', {event: 'teachers/listener/delete', data: payload})
    }
})

module.exports = {
    teachersFetch,
    teachersCreate,
    teachersDelete,
    teachersUpdate,
    Teachers
}