const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class Batches {
    name = 'Batches';
    description = 'Endpoints for creating student batches'
    data_types = {
        serial: new DataTypes(true).autonumber,
        batch_id: new DataTypes(true,['batches/update','batches/delete'],['batches/fetch']).uuid,
        batch_advisor_id: new DataTypes(true,[],['batches/update']).uuid,
        batch_no: new DataTypes(true,['batches/create'],['batches/update'],false,3).number,
        batch_stream: new DataTypes(true,['batches/create'],['batches/update'],false,3).string,
        enrollment_year: new DataTypes(true,['batches/create'],['batches/update'],false,2022).number,
        enrollment_season: new DataTypes(true,['batches/create'],['batches/update'],false,'spring').string,
        degree_type: new DataTypes(true,['batches/create'],['batches/update'],false,'msc').string,
        batch_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
    }
}

function batchesFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Batches,data.event)
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
            SELECT B.*,(SELECT count(student_id) AS registered_students FROM students_batch SB WHERE SB.batch_id = B.batch_id) FROM batches B
            ${data.batch_id ? ` WHERE B.batch_id = '${data.batch_id}'`:''}
            ORDER BY B.batch_creation_timestamp DESC
        `).then(res => {
            if (callback) {
                callback({
                    code: 200, 
                    status: 'OK',
                    data: res.rows
                })
            }
        }).catch(err => {
            console.log(err)
            if (callback) {
                callback(validations.validateDBSelectQueryError(err));
            }
        })
    }
}

function batchesCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Batches,data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        db.query(`INSERT INTO batches (
            batch_no,
            batch_stream,
            enrollment_year,
            enrollment_season,
            degree_type
            ${data.batch_advisor_id ? ',batch_advisor_id':''}
        ) VALUES (
            ${data.batch_no},
            '${data.batch_stream}',
            ${data.enrollment_year},
            '${data.enrollment_season}',
            '${data.degree_type}'
            ${data.batch_advisor_id ? `,'${data.batch_advisor_id}'`:''}
        )
        `).then(res => {
            if (callback) {
                callback({
                    code: 200, 
                    status: 'OK',
                    message: 'added record to db'
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

function batchesDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Batches,data.event)
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
            WITH query_one AS ( 
                DELETE FROM users WHERE user_id IN (
                    SELECT user_id from users
                    JOIN students_batch ON students_batch.student_id = users.user_id
                    WHERE students_batch.batch_id = '${data.batch_id}'
                    AND users.user_id NOT IN (
	                    SELECT user_id from users
	                    JOIN students_batch ON students_batch.student_id = users.user_id
	                    where students_batch.batch_id != '${data.batch_id}'
                    )
                )
            )
            DELETE FROM batches WHERE batch_id = '${data.batch_id}';
        `)
        .then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `deleted ${data.batch_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.batch_id} does not exist`
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

function batchesUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Batches,data.event)
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
        if (data.batch_no) update_clauses.push(`batch_no = ${data.batch_no}`)
        if (data.batch_stream) update_clauses.push(`batch_stream = '${data.batch_stream}'`)
        if (data.enrollment_year) update_clauses.push(`enrollment_year = ${data.enrollment_year}`)
        if (data.enrollment_season) update_clauses.push(`enrollment_season = '${data.enrollment_season}'`)
        if (data.degree_type) update_clauses.push(`degree_type = '${data.degree_type}'`)
        if (data.batch_advisor_id) update_clauses.push(`batch_advisor_id = '${data.batch_advisor_id}'`)
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
            UPDATE batches SET
            ${update_clauses.join(',')}
            WHERE batch_id = '${data.batch_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated ${data.batch_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.batch_id} does not exist`
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
    
    if (notification.channel == 'batches_insert') {
        event_emitter.emit('notifyAll', {event: 'batches/listener/insert', data: payload})
    }
    if (notification.channel == 'batches_update') {
        event_emitter.emit('notifyAll', {event: 'batches/listener/update', data: payload[0]})
    }
    if (notification.channel == 'batches_delete') {
        event_emitter.emit('notifyAll', {event: 'batches/listener/delete', data: payload})
    }
})

module.exports = {
    batchesCreate,
    batchesFetch,
    batchesDelete,
    batchesUpdate,
    Batches
}