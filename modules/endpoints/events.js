const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class Events {
    name = 'Events';
    description = 'Endpoints for creating news & events to be displayed on the main webpage'
    data_types = {
        serial: new DataTypes(true).autonumber,
        event_id: new DataTypes(true,['events/update','events/delete'],['events/fetch']).uuid,
        title: new DataTypes(true,['events/create'],['events/update']).string,
        body: new DataTypes(true,['events/create'],['events/update'],true).string,
        event_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
        event_expiry_timestamp: new DataTypes(true,[],['events/create','events/update']).unix_timestamp_milliseconds,
        record_limit: new DataTypes(false, [], ['events/fetch']).number
    }
}

function eventsFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
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
        db.query(`
            SELECT * FROM events 
            ${data.event_id ? ` WHERE event_id = '${data.event_id}'`:''}
            ORDER BY event_creation_timestamp DESC
            ${data.record_limit ? `LIMIT ${data.record_limit}`:''}
        `).then(res => {
            if (callback) {
                callback({
                    code: 200, 
                    status: 'OK',
                    data: res.rows
                })
            }
        }).catch(err => {
            console.error(err)
            if (callback) {
                callback(validations.validateDBSelectQueryError(err));
            }
        })
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
            title,
            body,
            event_expiry_timestamp
        ) VALUES (
            '${data.title}',
            '${data.body}',
            ${data.event_expiry_timestamp ? `${data.event_expiry_timestamp}` : null}
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
            console.error(err)
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
            console.error(err)
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
        if (data.title) update_clauses.push(`title = '${data.title}'`)
        if (data.body) update_clauses.push(`body = '${data.body}'`)
        if (data.event_expiry_timestamp) update_clauses.push(`event_expiry_timestamp = ${data.event_expiry_timestamp}`)
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
            console.error(err)
            if (callback) {
                callback(validations.validateDBUpdateQueryError(err));
            }
        })
    }
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);
    
    if (notification.channel == 'events_insert') {
        event_emitter.emit('notifyAll', {event: 'events/listener/insert', data: payload})
    }
    if (notification.channel == 'events_update') {
        event_emitter.emit('notifyAll', {event: 'events/listener/update', data: payload[0]})
    }
    if (notification.channel == 'events_delete') {
        event_emitter.emit('notifyAll', {event: 'events/listener/delete', data: payload})
    }
})

module.exports = {
    eventsCreate,
    eventsFetch,
    eventsDelete,
    eventsUpdate,
    Events
}