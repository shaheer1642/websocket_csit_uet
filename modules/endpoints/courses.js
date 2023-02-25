const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class Courses {
    name = 'Courses';
    description = 'Endpoints for creating courses'
    data_types = {
        course_id: new DataTypes(true,['courses/create','courses/update','courses/delete'],['courses/fetch'],false,'CS-103').string,
        course_name: new DataTypes(true,['courses/create'],['courses/update'],false,'Algorithms').string,
        departmental: new DataTypes(true,['courses/create'],['courses/update']).boolean,
        course_type: new DataTypes(true,['courses/create'],['courses/update'],false,'core').string,
        credit_hours: new DataTypes(true,['courses/create'],['courses/update'],false,3).number,
        course_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
    }
}

function coursesFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Courses,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.course_id)
            where_clauses.push(`course_id = '${data.course_id}'`)
        db.query(`
            SELECT * FROM courses
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

function coursesCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Courses,data.event)
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
            INSERT INTO courses (course_id,course_name, departmental, course_type, credit_hours) 
            VALUES (
                '${data.course_id}',
                '${data.course_name}',
                ${data.departmental},
                '${data.course_type}',
                ${data.credit_hours}
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

function coursesDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Courses,data.event)
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
            DELETE FROM courses WHERE course_id='${data.course_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `deleted ${data.course_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.course_id} does not exist`
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

function coursesUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Courses,data.event)
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
        if (data.course_name) update_clauses.push(`course_name = '${data.course_name}'`)
        if (data.departmental != undefined) update_clauses.push(`departmental = ${data.departmental}`)
        if (data.course_type) update_clauses.push(`course_type = '${data.course_type}'`)
        if (data.credit_hours) update_clauses.push(`credit_hours = ${data.credit_hours}`)
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
            UPDATE courses SET
            ${update_clauses.join(',')}
            WHERE course_id = '${data.course_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated ${data.course_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.course_id} does not exist`
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
    
    if (notification.channel == 'courses_insert') {
        event_emitter.emit('notifyAll', {event: 'courses/listener/insert', data: payload})
    }
    if (notification.channel == 'courses_update') {
        event_emitter.emit('notifyAll', {event: 'courses/listener/update', data: payload[0]})
    }
    if (notification.channel == 'courses_delete') {
        event_emitter.emit('notifyAll', {event: 'courses/listener/delete', data: payload})
    }
})

module.exports = {
    coursesFetch,
    coursesCreate,
    coursesDelete,
    coursesUpdate,
    Courses
}