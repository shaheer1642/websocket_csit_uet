const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter');
const { markingEvalutation, calculateAttendancePercentage } = require('../grading_functions');
const { default_objects } = require('../default_objects');

class StudentsCourses {
    name = 'Students Courses';
    description = 'Endpoints for assigning courses to students'
    data_types = {
        sem_course_id: new DataTypes(true,
            ['studentsCourses/updateGrade','studentsCourses/assignStudents','studentsCourses/updateMarkings','studentsCourses/updateAttendances'],
            ['studentsCourses/fetch']).uuid,
        student_batch_id: new DataTypes(true,
            ['studentsCourses/updateGrade'],
            ['studentsCourses/fetch']).uuid,
        student_batch_ids: new DataTypes(false,
            ['studentsCourses/assignStudents'],
            [],false,'["caa1534e-da15-41b6-8110-cc3fcffb14ed"]').array,
        grade: new DataTypes(true,
            ['studentsCourses/updateGrade'],
            ['studentsCourses/fetch'],false,'B').string,
        grade_change_logs: new DataTypes(true,[],[],false,'["timestamp user_id grade"]').array,
        marking: new DataTypes(true).json,
        markings: new DataTypes(true,['studentsCourses/updateMarkings']).array,
        attendance: new DataTypes(true).json,
        attendances: new DataTypes(true,['studentsCourses/updateAttendances']).array,
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
        if (data.sem_course_id) where_clauses.push(`SC.sem_course_id = '${data.sem_course_id}'`)
        if (data.student_batch_id) where_clauses.push(`SC.student_batch_id = '${data.student_batch_id}'`)
        if (data.semester_id) where_clauses.push(`SMC.semester_id = '${data.semester_id}'`)
        if (data.grade) where_clauses.push(`SC.grade = '${data.grade}'`)
        db.query(`
            SELECT * FROM students_courses SC
            JOIN students S ON S.student_id = (select student_id from students_batch where student_batch_id = SC.student_batch_id)
            JOIN semesters_courses SMC ON SMC.sem_course_id = SC.sem_course_id
            JOIN courses C ON C.course_id = SMC.course_id
            JOIN departments D ON C.department_id = D.department_id
            JOIN semesters SM ON SM.semester_id = SMC.semester_id
            JOIN teachers T ON SMC.teacher_id = T.teacher_id
            ${where_clauses.length > 0 ? 'WHERE':''}
            ${where_clauses.join(' AND ')}
            ORDER BY SC.enrollment_timestamp ASC
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: res.rows
            })
        }).catch(err => {
            console.error(err)
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
            SELECT * FROM semesters_courses WHERE sem_course_id = '${sem_course_id}';
            SELECT * from students_courses WHERE sem_course_id = '${sem_course_id}';
        `).then(res => {
            const semester_course = res[0].rows[0]
            if (semester_course.changes_locked) return callback({ code: 400, status: 'BAD REQUEST', message: 'The course is locked from changes' })
            const db_students_batch_ids = res[1].rows.map(row => row.student_batch_id)
            const received_students_batch_ids = data.student_batch_ids
            const insert_queries = []
            const delete_queries = []
            received_students_batch_ids.forEach(student_batch_id => {
                if (!db_students_batch_ids.includes(student_batch_id)) {
                    insert_queries.push(`INSERT INTO students_courses (sem_course_id, student_batch_id, marking, attendance) VALUES ('${sem_course_id}','${student_batch_id}','${JSON.stringify({...default_objects.students_courses_marking, student_batch_id: student_batch_id})}','${JSON.stringify({...default_objects.students_courses_attendance, student_batch_id: student_batch_id})}');`)
                }
            })
            db_students_batch_ids.forEach(student_batch_id => {
                if (!received_students_batch_ids.includes(student_batch_id)) {
                    delete_queries.push(`DELETE FROM students_courses WHERE sem_course_id='${sem_course_id}' AND student_batch_id='${student_batch_id}';`)
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
                console.error(err)
                callback? callback(validations.validateDBInsertQueryError(err)) : null
                db.query(`ROLLBACK;`).catch(console.error);
            })
        }).catch(err => {
            console.error(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

function studentsCoursesUpdateGrade(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    
    const validator = validations.validateRequestData(data,new StudentsCourses,data.event)
    if(!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`SELECT * FROM semesters_courses WHERE sem_course_id = '${data.sem_course_id}'`)
    .then(res => {
        if (res.rowCount != 1) return callback({ code: 500, status: 'INTERNAL ERROR', message: `Could not find course = ${data.sem_course_id}` })
        
        const semester_course = res.rows[0];
        if (semester_course.grades_locked) return callback({ code: 400, status: 'BAD REQUEST', message: 'The course is locked from changes' })

        db.query(`
            UPDATE students_courses SET
            grade = '${data.grade}',
            grade_change_logs = grade_change_logs || '"${new Date().getTime()} ${data.user_id} ${data.grade}"'
            WHERE sem_course_id = '${data.sem_course_id}' AND student_batch_id = '${data.student_batch_id}';
        `).then(res => {
            if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `updated sem_course=${data.sem_course_id} student_batch_id=${data.student_batch_id} record in db` });
            else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record sem_course=${data.sem_course_id} student_batch_id=${data.student_batch_id} does not exist` });
            else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
        }).catch(err => {
            console.error(err)
            return callback(validations.validateDBUpdateQueryError(err));
        })
    }).catch(err => {
        console.error(err)
        callback(validations.validateDBSelectQueryError(err));
    })

}

function studentsCoursesUpdateMarkings(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new StudentsCourses,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });
    
    db.query(`
        SELECT * FROM semesters_courses WHERE sem_course_id = '${data.sem_course_id}';
        SELECT * FROM students_courses WHERE sem_course_id = '${data.sem_course_id}';
    `).then(res => {
        if (res[0].rowCount != 1) return callback({ code: 500, status: 'INTERNAL ERROR', message: `Could not find course = ${data.sem_course_id}` })

        const semester_course = res[0].rows[0];
        const course_students = res[1].rows;
        const grade_distribution = semester_course.grade_distribution

        if (semester_course.grades_locked) return callback({ code: 400, status: 'BAD REQUEST', message: 'The course is locked from changes' })
        if (course_students.some(student => !data.markings.map(e => e.student_batch_id).includes(student.student_batch_id))) return callback({ code: 400, status: 'BAD REQUEST', message: 'Missing data for a student' })

        const update_queries = []
        markingEvalutation(grade_distribution, data.markings).forEach(marking => {
            update_queries.push(`UPDATE students_courses SET marking = '${JSON.stringify(marking)}' WHERE sem_course_id = '${data.sem_course_id}' AND student_batch_id = '${marking.student_batch_id}';`)
        })
        if (update_queries.length == 0) return callback({ code: 400, status: 'BAD REQUEST', message: 'No changes were made' })

        db.query(`
            BEGIN;
            ${update_queries.join('\n')}
            COMMIT;
        `).then(res => {
            return callback({ code: 200, status: 'OK', message: 'updated records in db' })
        }).catch(err => {
            db.query(`ROLLBACK;`).catch(console.error);
            console.error(err)
            return callback(validations.validateDBUpdateQueryError(err));
        })
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function studentsCoursesUpdateAttendances(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new StudentsCourses,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`SELECT * FROM semesters_courses WHERE sem_course_id = '${data.sem_course_id}'`)
    .then(res => {
        if (res.rowCount != 1) return callback({ code: 500, status: 'INTERNAL ERROR', message: `Could not find course = ${data.sem_course_id}` })
        
        const semester_course = res.rows[0];
        const grade_distribution = semester_course.grade_distribution

        if (semester_course.grades_locked) return callback({ code: 400, status: 'BAD REQUEST', message: 'The course is locked from changes' })

        const update_queries = []
        data.attendances.forEach(attendance => {
            const percentage = calculateAttendancePercentage(attendance)
            attendance = {
                ...attendance,
                percentage: percentage
            }
            update_queries.push(`UPDATE students_courses SET attendance = '${JSON.stringify(attendance)}', marking = marking || '{"attendance": ${Number((percentage/100*(grade_distribution.sessional.division.attendance.total_marks)).toFixed(1))}}' WHERE sem_course_id = '${data.sem_course_id}' AND student_batch_id = '${attendance.student_batch_id}';`)
        })
        if (update_queries.length == 0) return callback({ code: 400, status: 'BAD REQUEST', message: 'No changes were made' })

        db.query(`
            BEGIN;
            ${update_queries.join('\n')}
            COMMIT;
        `).then(res => {
            return callback({ code: 200, status: 'OK', message: 'updated records in db' })
        }).catch(err => {
            console.error(err)
            callback(validations.validateDBUpdateQueryError(err));
            db.query(`ROLLBACK;`).catch(console.error);;
        })
    }).catch(err => {
        console.error(err)
        callback(validations.validateDBSelectQueryError(err));
    })
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);
    
    if (['students_courses_insert','students_courses_update'].includes(notification.channel)) {
        db.query(`SELECT * FROM students_courses WHERE sem_course_id='${payload.sem_course_id}' AND student_batch_id='${payload.student_batch_id}'`)
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
    studentsCoursesUpdateMarkings,
    studentsCoursesUpdateAttendances,
    StudentsCourses
}