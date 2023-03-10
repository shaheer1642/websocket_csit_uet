const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter');
const { uploadFile } = require('../aws/aws');

class Documents {
    name = 'Documents';
    description = 'Endpoints for fetching/creating/deleting documents'
    data_types = {
        document: new DataTypes(false,['documents/create'],[],false,'file-buffer-string').string,
        document_id: new DataTypes(true,['documents/delete'],['documents/fetch']).uuid,
        document_name: new DataTypes(true,['documents/create'],[]).string,
        document_url: new DataTypes(true,[],[]).string,
        document_creation_timestamp: new DataTypes(true,[],[]).unix_timestamp_milliseconds,
    }
}

function documentsFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Documents,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.document_id)
            where_clauses.push(`document_id = '${data.document_id}'`)
        db.query(`
            SELECT * from documents
            ${where_clauses.length > 0 ? 'WHERE':''}
            ${where_clauses.join(' AND ')}
            ORDER BY document_creation_timestamp DESC
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

function documentsCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Documents,data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        uploadFile(data.document_name, data.document).then((fileUrl) => {
            db.query(`
                INSERT INTO documents (document_name, document_url) 
                VALUES (
                    '${data.document_name}',
                    '${fileUrl}'
                );
            `).then(res => {
                if (!callback) return
                if (res.rowCount == 1) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: 'added record to db',
                        data: res.rows[0]
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
        }).catch((err) => {
            console.log(err)
            callback({
                code: 200, 
                status: 'OK',
                message: `error uploading file: ${JSON.stringify(err)}`,
            });
        })
    }
}

function documentsDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Documents,data.event)
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
            DELETE FROM documents WHERE document_id='${data.document_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `deleted ${data.document_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.document_id} does not exist`
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

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);

    if (['documents_insert','documents_update','documents_delete'].includes(notification.channel)) {
        event_emitter.emit('notifyAll', {event: 'documents/listener/changed', data: payload[0] || payload})
    }
})

module.exports = {
    documentsFetch,
    documentsCreate,
    documentsDelete,
    Documents
}