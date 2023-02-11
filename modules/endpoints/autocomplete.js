const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class Autocomplete {
    name = 'Autocomplete';
    description = 'Endpoints for fetching data such as for select menus. The parameters and the data are very dynamic, and will change from time to time. Best to consult the back-end developer for any ambiguity or try testing by calling the endpoint'
    data_types = {
    }
}

function autocompleteTeachers(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Autocomplete,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        db.query(`
            SELECT * FROM teachers;
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: res.rows.map(row => ({id: row.teacher_id, label: row.teacher_name}))
            })
        }).catch(err => {
            console.log(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

function autocompleteCourses(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Autocomplete,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        db.query(`
            SELECT * FROM courses;
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: res.rows.map(row => ({id: row.course_id, label: `${row.course_id} ${row.course_name}`}))
            })
        }).catch(err => {
            console.log(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

module.exports = {
    autocompleteTeachers,
    autocompleteCourses,
    Autocomplete
}