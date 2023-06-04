const uuid = require('uuid');
const { template_applications_detail_structure_object, template_applications_forwarded_to } = require('./object_templates');
const { checkKeysExists } = require('./functions');

function validateKeyValue(key,value,type) {
    if (type == 'unix_timestamp_milliseconds') {
        if (Number(value) && value < 9999999999999) return { valid: true } 
        else return { valid: false, }
    } else if (type == 'number') {
        if (Number(value)) return { valid: true } 
        else return { valid: false, }
    } else if (type == 'uuid') {
        if (value == '') return { valid: true } 
        try {
            uuid.parse(value)
            return { valid: true } 
        } catch (e) {
            console.log(e)
            return { valid: false, }
        }
    } else if (type == 'boolean') {
        if (typeof value == 'boolean') return { valid: true } 
        else return { valid: false, }
    } else if (type == 'email') {
        if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(value)) return { valid: false, } 
        else return { valid: true, }
    } else return { valid: true }
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
            if (data[key] != undefined) {
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
            if (data[key] != undefined) {
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
    var message = err.detail || JSON.stringify(err)
    if (err.code == '23503') { code = 400, status = 'BAD REQUEST' }
    if (err.code == '23505') { code = 400, status = 'BAD REQUEST' }
    return {
        code: code, 
        status: status,
        message: message
    }
}
function validateDBSelectQueryError(err) {
    var code = 500
    var status = 'INTERNAL ERROR'
    var message = err.detail || JSON.stringify(err)
    return {
        code: code, 
        status: status,
        message: message
    }
}

function validateDBDeleteQueryError(err) {
    var code = 500
    var status = 'INTERNAL ERROR'
    var message = err.detail || JSON.stringify(err)
    return {
        code: code, 
        status: status,
        message: message
    }
}

function validateDBUpdateQueryError(err) {
    var code = 500
    var status = 'INTERNAL ERROR'
    var message = err.detail || JSON.stringify(err)
    if (err.code == '23505') { code = 400, status = 'BAD REQUEST' }
    return {
        code: code, 
        status: status,
        message: message
    }
}

function validateApplicationTemplateDetailStructure(detail_structure, options = {field_value_not_empty: false}) {
    if (Object.values(detail_structure).length == 0) return {valid: false, message: 'Detail structure cannot be empty'};

    if (detail_structure.some(o => !checkKeysExists(o,template_applications_detail_structure_object))) return {valid: false, message: 'Detail structure object mismatch'};
    if (detail_structure.some(o => o.field_name == '')) return {valid: false, message: 'Detail structure field_name cannot be empty'};
    if (detail_structure.some(o => o.field_type == '')) return {valid: false, message: 'Detail structure field_type cannot be empty'};
    if (detail_structure.some(o => options?.field_value_not_empty && o.field_value == '')) return {valid: false, message: 'Detail structure field_value cannot be empty'};
    if (detail_structure.some(o => o.disabled == true && !o.field_value)) return {valid: false, message: 'Detail structure field_value cannot be empty if disabled'};
    
    return {valid: true};
}

function validateApplicationForwardedTo(forwarded_to) {
    if (!checkKeysExists(forwarded_to,template_applications_forwarded_to,['status','forward_timestamp','receiver_remarks','completion_timestamp'])) return {valid: false, message: 'object mismatch'};

    if (!forwarded_to.sender_id) return {valid: false, message: 'Forwarded to sender_id cannot be empty'}
    if (!forwarded_to.receiver_id) return {valid: false, message: 'Forwarded to receiver_id cannot be empty'}
    if (!forwarded_to.sender_remarks) return {valid: false, message: 'Forwarded to sender_remarks cannot be empty'}

    return {valid: true};
}

module.exports = {
    validateRequestData,
    validateDBInsertQueryError,
    validateDBSelectQueryError,
    validateDBDeleteQueryError,
    validateDBUpdateQueryError,
    validateApplicationTemplateDetailStructure,
    validateApplicationForwardedTo
}