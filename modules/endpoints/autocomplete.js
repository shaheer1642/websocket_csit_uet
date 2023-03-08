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

function autocompleteBatchStudents(data, callback) {
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
        const where_clauses = []
        if (data.batch_id) where_clauses.push(`SB.batch_id = '${data.batch_id}'`)
        if (data.constraints) {
            if (data.constraints.includes('exclude_thesis_students')) 
                where_clauses.push('SB.student_batch_id NOT IN (select student_batch_id from students_thesis)')
        }
        db.query(`
            SELECT * FROM students_batch SB
            JOIN students S ON S.student_id = SB.student_id
            JOIN batches B ON B.batch_id = SB.batch_id
            ${where_clauses.length > 0 ? `WHERE `:''}
            ${where_clauses.join(' AND ')}
            ORDER BY S.student_name;
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: res.rows.map(row => ({id: row.student_batch_id, label: `${row.student_name} (${row.reg_no || row.cnic}) - ${row.degree_type}`}))
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
    autocompleteBatchStudents,
    Autocomplete
}