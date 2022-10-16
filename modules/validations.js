const uuid = require('uuid');

function validateKeyValue(key,value,type) {
    if (type == 'unix_timestamp_second') {
        if (Number(value) && value < 9999999999) return {
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
    return {
        valid: true
    }
}

function validateRequestData(data,object,event) {
    var required_keys = 0
    var optional_keys = 0
    for (const key in object) {
        if (object[key].required.includes(event)) {
            if (data[key]) {
                required_keys++;
                if (validateKeyValue(key, data[key], object[key].type).valid) continue
                else return {
                    valid: false,
                    key: key,
                    reason: `Invalid value ${data[key]} for key \'${key}\' of type ${object[key].type}. Example value: ${object[key].example_value}`
                }
            }
            else return {
                valid: false,
                key: key,
                reason: `Invalid data. Missing key \'${key}\' of type ${object[key].type}. Example value: ${object[key].example_value}`,
            }
        } else if (object[key].optional.includes(event)) {
            if (data[key]) {
                optional_keys++;
                if (validateKeyValue(key, data[key], object[key].type).valid) continue
                else return {
                    valid: false,
                    key: key,
                    reason: `Invalid value ${data[key]} for key \'${key}\' of type ${object[key].type}. Example value: ${object[key].example_value}`
                }
            }
        }
    }
    if (required_keys == 0 && optional_keys == 0) {
        return {
            valid: false,
            reason: `No valid parameters found in requested data.`,
        }
    } else {
        return {
            valid: true
        }
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