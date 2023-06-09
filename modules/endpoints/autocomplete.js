const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter');
const { convertUpper } = require('../functions');

class Autocomplete {
    name = 'Autocomplete';
    description = 'Endpoints for fetching data such as for select menus. The parameters and the data are very dynamic, and will change from time to time. Best to consult the back-end developer for any ambiguity or try testing by calling the endpoint'
    data_types = {
        exclude_user_types: new DataTypes(false,[],['autocomplete/users'],false,JSON.stringify(['admin','teacher'])).array,
        exclude_user_ids: new DataTypes(false,[],['autocomplete/users'],false,JSON.stringify(['e670c3ea-f740-11ed-a9d6-0242ac110032','7bce48da-f5c1-11ed-b0ba-0242ac110032'])).array,
        include_roles: new DataTypes(false,[],['autocomplete/teachers'],false,JSON.stringify(['chairman','semester_coordinator','batch_advisor'])).array,
        examiner_type: new DataTypes(false,[],['autocomplete/studentsThesisExaminers'],false,'internal_examiner').string,
    }
}

function autocompleteUsers(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Autocomplete,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        SELECT * FROM users WHERE user_type NOT IN ('student','teacher');
        SELECT * FROM users JOIN students on students.student_id = users.user_id;
        SELECT * FROM users JOIN teachers on teachers.teacher_id = users.user_id;
    `).then(res => {
        var users_list = []

        res[0].rows.concat(res[1].rows.concat(res[2].rows)).forEach(user => {
            users_list.push({
                user_id: user.user_id,
                name:  user.student_name || user.teacher_name || user.user_type,
                user_type: user.user_type
            })
        })

        if (data.exclude_user_types)  users_list = users_list.filter(user => !data.exclude_user_types.includes(user.user_type))
        if (data.exclude_user_ids) users_list = users_list.filter(user => !data.exclude_user_ids.includes(user.user_id))

        return callback({ 
            code: 200, 
            status: 'OK', 
            data: users_list.map(user => ({id: user.user_id, label: user.name})) 
        })
    }).catch(err => {
        console.error(err)
        callback(validations.validateDBSelectQueryError(err));
    })
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
            SELECT 
            T.*,
            (SELECT department_id AS chairman FROM departments WHERE chairman_id = T.teacher_id) ,
            (SELECT 'Batch '||batch_no||' '||degree_type||' '||batch_stream AS batch_advisor FROM batches WHERE batch_advisor_id = T.teacher_id limit 1),
            (SELECT CASE WHEN semester_coordinator_id = T.teacher_id THEN semester_season::text||' '||semester_year END AS semester_coordinator FROM semesters ORDER BY semester_start_timestamp DESC limit 1)
            FROM teachers T;
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: res.rows.map(row => ({
                    id: row.teacher_id, 
                    label: `${row.teacher_name}${row.chairman && data.include_roles?.includes('chairman') ? ` (Chairman - ${row.chairman})`:''}${row.batch_advisor && data.include_roles?.includes('batch_advisor') ? ` (Batch Advisor - ${row.batch_advisor.split(' ').map(str => convertUpper(str)).join(' ')})`:''}${row.semester_coordinator && data.include_roles?.includes('semester_coordinator') ? ` (Semester Coordinator - ${row.semester_coordinator.split(' ').map(str => convertUpper(str)).join(' ')})`:''}`
                }))
            })
        }).catch(err => {
            console.error(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

function autocompleteFaculty(data, callback) {
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
            SELECT * FROM users WHERE username = 'admin' OR username = 'pga';
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: [...res.rows.map(row => ({id: row.user_id, label: row.username}))]
            })
        }).catch(err => {
            console.error(err)
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
            console.error(err)
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
            console.error(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

function autocompleteStudentsThesisExaminers(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Autocomplete,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    const where_clauses = []
    if (data.examiner_type) where_clauses.push(`examiner_type = '${data.examiner_type}'`)

    db.query(`
        SELECT * FROM students_thesis_examiners
        ${where_clauses.length > 0 ? `WHERE `:''}
        ${where_clauses.join(' AND ')}
        ORDER BY examiner_creation_timestamp;
    `).then(res => {
        return callback({
            code: 200, 
            status: 'OK',
            data: res.rows.map(row => ({id: row.examiner_id, label: `${row.examiner_name} - ${row.examiner_designation} @ ${row.examiner_university}`}))
        })
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function autocompleteAreasOfInterest(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Autocomplete,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        SELECT * FROM teachers WHERE jsonb_array_length(areas_of_interest) > 0;
    `).then(res => {
        return callback({ code: 200, status: 'OK', data: res.rows.reduce((arr,row) => ([...arr, ...row.areas_of_interest]),[]) })
    }).catch(err => {
        console.error(err)
        callback(validations.validateDBSelectQueryError(err));
    })
}

module.exports = {
    autocompleteUsers,
    autocompleteFaculty,
    autocompleteTeachers,
    autocompleteCourses,
    autocompleteBatchStudents,
    autocompleteStudentsThesisExaminers,
    autocompleteAreasOfInterest,
    Autocomplete
}