const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class Semesters {
    name = 'Semesters';
    description = 'Endpoints for creating semesters for batches'
    data_types = {
        semester_id: new DataTypes(true,['semesters/update','semesters/delete'],['semesters/fetch']).uuid,
        semester_year: new DataTypes(true,['semesters/create'],['semesters/update'],false,2020).number,
        semester_season: new DataTypes(true,['semesters/create'],['semesters/update'],false,'fall').string,
        semester_start_timestamp: new DataTypes(true,['semesters/create'],['semesters/update']).unix_timestamp_milliseconds,
        semester_end_timestamp: new DataTypes(true,['semesters/create'],['semesters/update']).unix_timestamp_milliseconds,
        semester_coordinator_id: new DataTypes(true,[],['semesters/update','semesters/create']).uuid,
        student_id: new DataTypes(false,[],['semesters/fetch']).uuid,
    }
}

function semestersFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Semesters,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.semester_id) where_clauses.push(`S.semester_id = '${data.semester_id}'`)
        if (data.student_id) where_clauses.push(`S.semester_start_timestamp > (SELECT student_creation_timestamp FROM students WHERE student_id = '${data.student_id}')`)
        db.query(`
            SELECT S.*,(SELECT count(course_id) AS offered_courses FROM semesters_courses SC WHERE SC.semester_id = S.semester_id) FROM semesters S
            ${where_clauses.length > 0 ? 'WHERE':''}
            ${where_clauses.join(' AND ')}
            ORDER BY S.semester_start_timestamp DESC;
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

function semestersCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Semesters,data.event)
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
            INSERT INTO semesters (semester_year, semester_season, semester_coordinator_id, semester_start_timestamp, semester_end_timestamp) 
            VALUES (
                ${data.semester_year},
                '${data.semester_season}',
                ${data.semester_coordinator_id ? `'${data.semester_coordinator_id}'` : 'NULL'},
                ${data.semester_start_timestamp},
                ${data.semester_end_timestamp}
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

function semestersDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Semesters,data.event)
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
            DELETE FROM semesters WHERE semester_id='${data.semester_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `deleted ${data.semester_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.semester_id} does not exist`
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

function semestersUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Semesters,data.event)
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
        if (data.semester_year) update_clauses.push(`semester_year = ${data.semester_year}`)
        if (data.semester_season) update_clauses.push(`semester_season = '${data.semester_season}'`)
        if (data.semester_coordinator_id != undefined) update_clauses.push(`semester_coordinator_id = ${data.semester_coordinator_id ? `'${data.semester_coordinator_id}'`:'NULL'}`)
        if (data.semester_start_timestamp) update_clauses.push(`semester_start_timestamp = ${data.semester_start_timestamp}`)
        if (data.semester_end_timestamp) update_clauses.push(`semester_end_timestamp = ${data.semester_end_timestamp}`)
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
            UPDATE semesters SET
            ${update_clauses.join(',')}
            WHERE semester_id = '${data.semester_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated ${data.semester_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.semester_id} does not exist`
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
    
    if (notification.channel == 'semesters_insert') {
        event_emitter.emit('notifyAll', {event: 'semesters/listener/insert', data: payload})
    }
    if (notification.channel == 'semesters_update') {
        event_emitter.emit('notifyAll', {event: 'semesters/listener/update', data: payload[0]})
    }
    if (notification.channel == 'semesters_delete') {
        event_emitter.emit('notifyAll', {event: 'semesters/listener/delete', data: payload})
    }
})

module.exports = {
    semestersFetch,
    semestersCreate,
    semestersDelete,
    semestersUpdate,
    Semesters
}