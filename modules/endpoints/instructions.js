const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class Instructions {
    name = 'Instructions';
    description = 'Endpoints for fetching/updating instructions'
    data_types = {
        instruction_id: new DataTypes(true,['instructions/update'],['instructions/fetch'],false,3).number,
        detail: new DataTypes(true,['instructions/update'],[]).json,
    }
}

function instructionsFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Instructions,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.instruction_id) where_clauses.push(`instruction_id = ${data.instruction_id}`)
        db.query(`
            SELECT * from instructions
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

function instructionsUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Instructions,data.event)
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
        if (data.detail) update_clauses.push(`detail = '${JSON.stringify(data.detail).replace(/'/g,`''`)}'`)
        if (update_clauses.length == 0) {
            return callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: `No valid parameters found in requested data.`,
            });
        }
        db.query(`
            UPDATE instructions SET
            ${update_clauses.join(',')}
            WHERE instruction_id = ${data.instruction_id};
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated ${data.instruction_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.instruction_id} does not exist`
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
    instructionsFetch,
    instructionsUpdate,
    Instructions
}