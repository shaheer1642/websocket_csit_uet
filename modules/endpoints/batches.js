const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')

class Batches {
    name = 'Batches';
    description = 'Endpoints for creating student batches'
    data_types = {
        serial: new DataTypes(true).autonumber,
        batch_id: new DataTypes(true,['batches/update','batches/delete'],['batches/fetch']).uuid,
        batch_advisor_id: new DataTypes(true,[],['batches/create','batches/update']).uuid,
        batch_no: new DataTypes(true,['batches/create'],['batches/update']).number,
        joined_semester: new DataTypes(true,['batches/create'],['batches/update']).string,
        degree_type: new DataTypes(true,['batches/create'],['batches/update']).string,
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
            SELECT * FROM batches 
            ${data.batch_id ? ` WHERE batch_id = '${data.batch_id}'`:''}
            ORDER BY batch_creation_timestamp ASC
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
            joined_semester,
            degree_type
            ${data.batch_advisor_id ? ',batch_advisor_id':''}
        ) VALUES (
            '${data.batch_no}',
            '${data.joined_semester}',
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
        if (data.batch_no) update_clauses.push(`batch_no = '${data.batch_no}'`)
        if (data.joined_semester) update_clauses.push(`joined_semester = '${data.joined_semester}'`)
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

module.exports = {
    batchesCreate,
    batchesFetch,
    batchesDelete,
    batchesUpdate,
    Batches
}