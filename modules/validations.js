const uuid = require('uuid');

function validateKeyValue(key,value,type) {
    if (type == 'unix_timestamp_milliseconds') {
        if (Number(value) && value < 9999999999999) return {
            valid: true
        } 
        else return {
            valid: false,
        }
    } else if (type == 'number') {
        if (Number(value)) return {
            valid: true
        } 
        else return {
            valid: false,
        }
    }
    else if (type == 'uuid') {
        try {
            uuid.parse(value)
            return {
                valid: true
            } 
        } catch (e) {
            console.log(e)
            return {
                valid: false,
            }
        }
    }
    else if (type == 'boolean') {
        if (typeof value == 'boolean') return {
            valid: true
        } 
        else return {
            valid: false,
        }
    }
    return {
        valid: true
    }
}

function validateRequestData(data,object,event) {
    var required_keys = 0
    var optional_keys = 0
    var required_length = 0
    var optional_length = 0
    for (const key in object.data_types) {
        const field = object.data_types[key]
        required_length = field.required.length
        optional_length = field.optional.length
        if (field.required.includes(event)) {
            if (data[key]) {
                required_keys++;
                if (validateKeyValue(key, data[key], field.type).valid) continue
                else return {
                    valid: false,
                    key: key,
                    reason: `Invalid value ${data[key]} for key \'${key}\' of type ${field.type}. Example value: ${field.example_value}`
                }
            }
            else return {
                valid: false,
                key: key,
                reason: `Invalid data. Missing key \'${key}\' of type ${field.type}. Example value: ${field.example_value}`,
            }
        } else if (field.optional.includes(event)) {
            if (data[key]) {
                optional_keys++;
                if (validateKeyValue(key, data[key], field.type).valid) continue
                else return {
                    valid: false,
                    key: key,
                    reason: `Invalid value ${data[key]} for key \'${key}\' of type ${field.type}. Example value: ${field.example_value}`
                }
            }
        }
    }
    return {
        valid: true
    }
}

function validateDBInsertQueryError(err) {
    var code = 500
    var status = 'INTERNAL ERROR'
    var message = err
    if (err.code == '23503') {
        code = 400,
        status = 'BAD REQUEST',
        message =  err.detail
    }
    if (err.code == '23505') {
        code = 400,
        status = 'BAD REQUEST',
        message =  err.detail
    }
    return {
        code: code, 
        status: status,
        message: message
    }
}
function validateDBSelectQueryError(err) {
    var code = 500
    var status = 'INTERNAL ERROR'
    var message = err
    return {
        code: code, 
        status: status,
        message: message
    }
}

function validateDBDeleteQueryError(err) {
    var code = 500
    var status = 'INTERNAL ERROR'
    var message = err
    return {
        code: code, 
        status: status,
        message: message
    }
}

function validateDBUpdateQueryError(err) {
    var code = 500
    var status = 'INTERNAL ERROR'
    var message = err
    return {
        code: code, 
        status: status,
        message: message
    }
}

module.exports = {
    validateRequestData,
    validateDBInsertQueryError,
    validateDBSelectQueryError,
    validateDBDeleteQueryError,
    validateDBUpdateQueryError,
}