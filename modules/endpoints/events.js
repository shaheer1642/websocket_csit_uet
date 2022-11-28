const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')

class Events {
    name = 'Events';
    description = 'Endpoints for creating news & events to be displayed on the main webpage'
    data_types = {
        s_no: new DataTypes(true).autonumber,
        event_id: new DataTypes(true,['events/update','events/delete'],['events/fetch']).uuid,
        user_id: new DataTypes(true,[],['events/fetch']).uuid,
        title: new DataTypes(true,['events/create'],['events/update']).string,
        body: new DataTypes(true,['events/create'],['events/update']).string,
        creation_timestamp: new DataTypes(true).unix_timestamp_second,
        expiry_timestamp: new DataTypes(true,['events/create'],['events/update']).unix_timestamp_second,
        record_limit: new DataTypes(false, [], ['events/fetch']).number
    }
}

function eventsFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!data || Object.keys(data).length == 0) {
        db.query(`SELECT * FROM events ORDER BY creation_timestamp DESC`)
        .then(res => {
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
    } else {
        const validator = validations.validateRequestData(data,new Events,data.event)
        if (!validator.valid) {
            if (callback) {
                callback({
                    code: 400, 
                    status: 'BAD REQUEST',
                    message: validator.reason
                });
            }
        } else {
            var where_clauses = []
            if (data.user_id)
                where_clauses.push(`user_id = '${data.user_id}'`)
            if (data.event_id)
                where_clauses.push(`event_id = '${data.event_id}'`)
            console.log(`
                SELECT * FROM events 
                ${where_clauses.length > 0 ? 'WHERE':''}
                ${where_clauses.join(' AND ')}
                ORDER BY creation_timestamp DESC
                ${data.record_limit ? `LIMIT ${data.record_limit}`:''}
            `)
            db.query(`
                SELECT * FROM events 
                ${where_clauses.length > 0 ? 'WHERE':''}
                ${where_clauses.join(' AND ')}
                ORDER BY creation_timestamp DESC
                ${data.record_limit ? `LIMIT ${data.record_limit}`:''}
            `)
            .then(res => {
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
}

function eventsCreate(data, callback) {
    console.log('[events/create] called')
    console.log('[events/create] data received:',data)
    const validator = validations.validateRequestData(data,new Events,'events/create')
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        db.query(`INSERT INTO events (
            event_id,
            user_id,
            title,
            body,
            creation_timestamp,
            expiry_timestamp
        ) VALUES (
            '${uuid.v4()}',
            (SELECT user_id FROM users WHERE login_token = '${data.socket_id}'),
            '${data.title}',
            '${data.body}',
            ${new Date().getTime()},
            ${data.expiry_timestamp}
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

function eventsDelete(data, callback) {
    console.log('[events/delete] called')
    console.log('[events/delete] data received:',data)
    const validator = validations.validateRequestData(data,new Events,'events/delete')
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        db.query(`DELETE FROM events WHERE event_id = '${data.event_id}'`)
        .then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `deleted event ${data.event_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `event ${data.event_id} does not exist`
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

function eventsUpdate(data, callback) {
    console.log('[events/update] called')
    console.log('[events/update] data received:',data)
    const validator = validations.validateRequestData(data,new Events,'events/update')
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        var update_clauses = []
        if (data.title)
            update_clauses.push(`title = '${data.title}'`)
        if (data.body)
            update_clauses.push(`body = '${data.body}'`)
        if (data.expiry_timestamp)
            update_clauses.push(`expiry_timestamp = ${data.expiry_timestamp}`)
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
            UPDATE events SET
            ${update_clauses.join(',')}
            WHERE event_id = '${data.event_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated event ${data.event_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `event ${data.event_id} does not exist`
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
    eventsCreate,
    eventsFetch,
    eventsDelete,
    eventsUpdate,
    Events
}