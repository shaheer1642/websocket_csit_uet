const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class StudentsCourses {
    name = 'Students Courses';
    description = 'Endpoints for assigning courses to students'
    data_types = {
        sem_course_id: new DataTypes(true,
            ['studentsCourses/updateGrade','studentsCourses/assignStudents',],
            ['studentsCourses/fetch']).uuid,
        student_id: new DataTypes(true,
            ['studentsCourses/updateGrade'],
            ['studentsCourses/fetch']).uuid,
        student_ids: new DataTypes(false,
            ['studentsCourses/assignStudents'],
            [],false,'["caa1534e-da15-41b6-8110-cc3fcffb14ed"]').array,
        grade: new DataTypes(true,
            ['studentsCourses/updateGrade'],
            ['studentsCourses/fetch'],false,'B').string,
        grade_assignment_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
        grade_assigned_by: new DataTypes(true).uuid,
        grade_change_logs: new DataTypes(true,[],[],false,'["timestamp user_id grade"]').array,
        batch_id: new DataTypes(false,
            ['studentsCourses/fetchBatchCourses'],
            []).uuid,
    }
}

function studentsCoursesFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new StudentsCourses,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.sem_course_id) where_clauses.push(`sem_course_id = '${data.sem_course_id}'`)
        if (data.student_id) where_clauses.push(`student_id = '${data.student_id}'`)
        if (data.grade) where_clauses.push(`grade = '${data.grade}'`)
        db.query(`
            SELECT * FROM students_courses
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

function studentsCoursesAssignStudents(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new StudentsCourses,data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        const sem_course_id = data.sem_course_id
        db.query(`
            SELECT * from students_courses WHERE sem_course_id = '${sem_course_id}'
        `).then(res => {
            const db_students_ids = res.rows.map(row => row.student_id)
            const received_students_ids = data.student_ids
            const insert_queries = []
            const delete_queries = []
            received_students_ids.forEach(student_id => {
                if (!db_students_ids.includes(student_id)) {
                    insert_queries.push(`INSERT INTO students_courses (sem_course_id, student_id) VALUES ('${sem_course_id}','${student_id}');`)
                }
            })
            db_students_ids.forEach(student_id => {
                if (!received_students_ids.includes(student_id)) {
                    delete_queries.push(`DELETE FROM students_courses WHERE sem_course_id='${sem_course_id}' AND student_id='${student_id}';`)
                }
            })
            if (insert_queries.length == 0 && delete_queries.length == 0) {
                return callback? callback({
                    code: 400, 
                    status: 'BAD REQUEST',
                    message: 'No changes were made'
                }):null
            }
            db.query(`
                BEGIN;
                ${insert_queries.join('\n')}
                ${delete_queries.join('\n')}
                COMMIT;
            `).then(res => {
                console.log(res)
                callback? callback({
                    code: 200, 
                    status: 'OK',
                    message: 'updated records in db'
                }):null
            }).catch(err => {
                console.log(err)
                callback? callback(validations.validateDBInsertQueryError(err)) : null
            })
        }).catch(err => {
            console.log(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

function studentsCoursesUpdateGrade(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new StudentsCourses,data.event)
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
        if (data.grade) update_clauses.push(`grade = '${data.grade}'`)
        if (update_clauses.length == 0) {
            if (callback) {
                callback({
                    code: 400, 
                    status: 'BAD REQUEST',
                    message: `No valid parameters found in requested data.`,
                });
            }
            return
        }
        db.query(`
            UPDATE students_courses SET
            grade = '${data.grade}',
            grade_assignment_timestamp = ${new Date().getTime()},
            grade_assigned_by = '${data.user_id}',
            grade_change_logs = grade_change_logs || '"${new Date().getTime()} ${data.user_id} ${data.grade}"'
            WHERE sem_course_id = '${data.sem_course_id}' AND student_id = '${data.student_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated sem_course=${data.sem_course_id} student=${data.student_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record sem_course=${data.sem_course_id} student=${data.student_id} does not exist`
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

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);
    
    if (['students_courses_insert','students_courses_update'].includes(notification.channel)) {
        db.query(`SELECT * FROM students_courses WHERE sem_course_id='${payload.sem_course_id}' AND student_id='${payload.student_id}'`)
        .then(res => {
            if (res.rowCount == 1) {
                event_emitter.emit('notifyAll', {event: 'studentsCourses/listener/changed', data: res.rows[0]})
            }
        }).catch(console.error)
    }
    
    if (['students_courses_delete'].includes(notification.channel)) {
        event_emitter.emit('notifyAll', {event: 'studentsCourses/listener/changed', data: payload[0] || payload})
    }
})

module.exports = {
    studentsCoursesFetch,
    studentsCoursesAssignStudents,
    studentsCoursesUpdateGrade,
    StudentsCourses
}