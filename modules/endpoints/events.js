const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');


class Events {
    s_no = {
        type: 'autonumber',
        required: [],
        optional: [],
        example_value: 3
    };
    event_id = {
        type: 'uuid',
        required: [], 
        optional: ['events/fetch'],
        example_value: 'caa1534e-da15-41b6-8110-cc3fcffb14ed'
    };
    user_id = {
        type: 'uuid',
        required: ['events/create'],
        optional: ['events/fetch'],
        example_value: 'caa1534e-da15-41b6-8110-cc3fcffb14ed'
    };
    title = {
        type: 'string',
        required: ['events/create'],
        optional: [],
        example_value: 'some-title-string'
    };
    body = {
        type: 'string',
        required: ['events/create'],
        optional: [],
        example_value: 'some-body-string'
    };
    creation_timestamp = {
        type: 'unix_timestamp_second',
        required: [],
        optional: [],
        example_value: 1665774803
    };
    expiry_timestamp = {
        type: 'unix_timestamp_second',
        required: ['events/create'],
        optional: [],
        example_value: 1665774803
    };
    
    record_limit = {
        type: 'number',
        required: [],
        optional: ['events/fetch'],
        example_value: 3
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
        db.query(`INSERT INTO events(
            event_id,
            user_id,
            title,
            body,
            creation_timestamp,
            expiry_timestamp
        ) VALUES (
            '${uuid.v4()}',
            '${data.user_id}',
            '${data.title}',
            '${data.body}',
            ${new Date().getTime() / 1000},
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

function eventsFetch(data, callback) {
    console.log('[events/fetch] called')
    console.log('[events/fetch] data received:',data)
    if (!data || Object.keys(data).length == 0) {
        db.query(`SELECT * FROM events ORDER BY creation_timestamp DESC`)
        .then(res => {
            if (callback) {
                callback(res.rows)
            }
        }).catch(err => {
            console.log(err)
            if (callback) {
                callback(validations.validateDBSelectQueryError(err));
            }
        })
    } else {
        const validator = validations.validateRequestData(data,new Events,'events/fetch')
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
                    callback(res.rows)
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

module.exports = {
    eventsCreate,
    eventsFetch
}