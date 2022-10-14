const uuid = require('uuid');

function validateKeyValue(key,value,type) {
    if (type == 'unix_timestamp_second') {
        if (Number(value)) return {
            valid: true
        } 
        else return {
            valid: false,
            reason: `Invalid value ${value} for key \'${key}\'. Example value: 1665774803`,
        }
    } else if (type == 'uuid') {
        try {
            uuid.parse(value)
            return {
                valid: true
            } 
        } catch (e) {
            console.log(e)
            return {
                valid: false,
                reason: `Invalid value ${value} for key \'${key}\'. Example value: 'caa1534e-da15-41b6-8110-cc3fcffb14ed'`,
            }
        }
    }
    return {
        valid: true
    }
}

function validateRequestData(data,object,event) {
    for (const key in object) {
        if (object[key].required.includes(event)) {
            if (data[key]) {
                const validator = validateKeyValue(key, data[key], object[key].type)
                if (validator.valid) continue
                else return {
                    valid: false,
                    key: key,
                    reason: validator.reason
                }
            }
            else return {
                valid: false,
                key: key,
                reason: `Invalid data. Missing key \'${key}\'  of type ${object[key].type}. Example value: ${object[key].example_value}`,
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

module.exports = {
    validateRequestData,
    validateDBInsertQueryError,
    validateDBSelectQueryError
}