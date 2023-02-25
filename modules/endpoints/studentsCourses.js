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
            ['studentsCourses/updateGrade','studentsCourses/assignStudents','studentsCourses/updateMarkings','studentsCourses/updateAttendances'],
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
        if (data.sem_course_id) where_clauses.push(`sem_course_id = '${data.sem_course_id}'`)
        if (data.student_id) where_clauses.push(`student_id = '${data.student_id}'`)
        if (data.grade) where_clauses.push(`grade = '${data.grade}'`)
        db.query(`
            SELECT * FROM students_courses SC
            JOIN students S ON S.student_id = SC.student_id
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

function markingEvalutation(grade_distribution, markings) {
    // absolute evaluation
    markings.forEach((marking,index) => {
        const absolute_evaluation = {}
        absolute_evaluation.final_term = {
            total: (grade_distribution.final_term.total_marks) * (grade_distribution.final_term.weightage / 100),
            obtained: (marking.final_term) * (grade_distribution.final_term.weightage / 100)
        }
        absolute_evaluation.mid_term = {
            total: (grade_distribution.mid_term.total_marks) * (grade_distribution.mid_term.weightage / 100),
            obtained: (marking.mid_term) * (grade_distribution.mid_term.weightage / 100)
        }
        absolute_evaluation.sessional = {
            total: (Object.keys(grade_distribution.sessional.division).filter(key => grade_distribution.sessional.division[key].include)
                .reduce((sum,key) => key.match('assignments') ? 
                    sum += grade_distribution.sessional.division.assignments.no_of_assignments * grade_distribution.sessional.division.assignments.total_marks_per_assignment
                    : key.match('quizzes') ? 
                    sum += grade_distribution.sessional.division.quizzes.no_of_quizzes * grade_distribution.sessional.division.quizzes.total_marks_per_quiz
                    : sum += grade_distribution.sessional.division[key].total_marks
                , 0)) * (grade_distribution.sessional.weightage / 100),
            obtained: (Object.keys(grade_distribution.sessional.division).filter(key => grade_distribution.sessional.division[key].include)
                .reduce((sum,key) => key.match('assignments') ? 
                    sum += Object.keys(marking).reduce((sum,key2) => key2.match('assignment') ? sum += marking[key2] : sum += 0, 0)
                    : key.match('quizzes') ? 
                    sum += Object.keys(marking).reduce((sum,key2) => key2.match('quiz') ? sum += marking[key2] : sum += 0, 0)
                    : sum += marking[key] || 0
                , 0)) * (grade_distribution.sessional.weightage / 100),
        }
        const absolute_total_marks = Number((Object.keys(absolute_evaluation).reduce((sum,key) => sum += absolute_evaluation[key].total, 0)).toFixed(1))
        const absolute_obtained_marks = Number((Object.keys(absolute_evaluation).reduce((sum,key) => sum += absolute_evaluation[key].obtained, 0)).toFixed(1))
        const absolute_percentage = Number(((absolute_obtained_marks / absolute_total_marks) * 100).toFixed(1))
        const result = {
            absolute: {
                evaluation: absolute_evaluation,
                total_marks: absolute_total_marks,
                obtained_marks: absolute_obtained_marks,
                percentage: absolute_percentage,
                grade: calculateGrade(absolute_percentage)
            }
        }
        markings[index].result = result
    })
    // relative evaluation
    markings = markings.sort((a, b) => a.result.absolute.percentage > b.result.absolute.percentage ? -1 : 1)
    const top_students_length = Math.ceil(markings.length * grade_distribution.marking.average_top / 100)
    const highest_marks = Number(((markings
                            .filter((o,index) => index < top_students_length)
                            .reduce((sum,marking) => sum += marking.result.absolute.obtained_marks, 0)) / top_students_length).toFixed(1))
    markings.forEach((marking,index) => {
        const relative_total_marks = highest_marks
        const relative_obtained_marks = marking.result.absolute.obtained_marks > highest_marks ? highest_marks : marking.result.absolute.obtained_marks
        const relative_percentage = Number(((relative_obtained_marks / relative_total_marks) * 100).toFixed(1))
        const result = {
            relative: {
                total_marks: relative_total_marks,
                obtained_marks: relative_obtained_marks,
                percentage: relative_percentage,
                grade: calculateGrade(relative_percentage)
            }
        }
        markings[index].result = {
            absolute: marking.result.absolute,
            relative: result.relative
        }
    })
    return markings

    function calculateGrade(percentage) {
        if (percentage >= 95)
            return 'A'
        else if (percentage >= 90)
            return 'A-'
        else if (percentage >= 85)
            return 'B+'
        else if (percentage >= 80)
            return 'B'
        else if (percentage >= 75)
            return 'B-'
        else if (percentage >= 70)
            return 'C+'
        else if (percentage >= 65)
            return 'C'
        else if (percentage >= 60)
            return 'C-'
        else if (percentage >= 55)
            return 'D+'
        else if (percentage >= 50)
            return 'D'
        else return 'F'
    }
}

function studentsCoursesUpdateMarkings(data, callback) {
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
        db.query(`
            SELECT * FROM semesters_courses WHERE sem_course_id = '${data.sem_course_id}';
            SELECT * FROM students_courses WHERE sem_course_id = '${data.sem_course_id}';
        `).then(res => {
            if (res[0].rowCount == 1) {
                const semester_course = res[0].rows[0];
                const course_students = res[1].rows;
                if (course_students.some(student => !data.markings.map(e => e.student_id).includes(student.student_id))) {
                    return callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: 'Missing data for a student'
                    })
                }
                const grade_distribution = semester_course.grade_distribution
                const update_queries = []

                markingEvalutation(grade_distribution, data.markings).forEach(marking => {
                    update_queries.push(`UPDATE students_courses SET marking = '${JSON.stringify(marking)}' WHERE sem_course_id = '${data.sem_course_id}' AND student_id = '${marking.student_id}';`)
                })

                if (update_queries.length == 0) {
                    return callback? callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: 'No changes were made'
                    }) : null
                }
                db.query(`
                    BEGIN;
                    ${update_queries.join('\n')}
                    COMMIT;
                `).then(res => {
                    callback? callback({
                        code: 200, 
                        status: 'OK',
                        message: 'updated records in db'
                    }): null
                }).catch(err => {
                    console.log(err)
                    callback(validations.validateDBUpdateQueryError(err));
                })
            } else {
                return callback? callback({
                    code: 500, 
                    status: 'INTERNAL ERROR',
                    message: `Could not find course = ${data.sem_course_id}`
                }) : null
            }
        }).catch(err => {
            console.log(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

function studentsCoursesUpdateAttendances(data, callback) {
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
        db.query(`SELECT * FROM semesters_courses WHERE sem_course_id = '${data.sem_course_id}'`)
        .then(res => {
            if (res.rowCount == 1) {
                const grade_distribution = res.rows[0].grade_distribution
                const update_queries = []
                console.log(JSON.stringify(grade_distribution))
                data.attendances.forEach(attendance => {
                    const percentage = Number((((Object.keys(attendance).filter(key => key.match('week'))
                                        .reduce((sum,key) => (attendance[key] == 'P' || attendance[key] == 'L') ? sum += 1 : sum += 0, 0)) / 
                                        (Object.keys(attendance).filter(key => key.match('week'))
                                        .reduce((sum,key) => (attendance[key] == '') ? sum += 0 : sum += 1, 0))) * 100).toFixed(1))
                    attendance = {
                        ...attendance,
                        percentage: percentage
                    }
                    update_queries.push(`UPDATE students_courses SET attendance = '${JSON.stringify(attendance)}', marking = marking || '{"attendance": ${Number((percentage/100*(grade_distribution.sessional.division.attendance.total_marks)).toFixed(1))}}' WHERE sem_course_id = '${data.sem_course_id}' AND student_id = '${attendance.student_id}';`)
                })
                if (update_queries.length == 0) {
                    return callback? callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: 'No changes were made'
                    }) : null
                }
                db.query(`
                    BEGIN;
                    ${update_queries.join('\n')}
                    COMMIT;
                `).then(res => {
                    callback? callback({
                        code: 200, 
                        status: 'OK',
                        message: 'updated records in db'
                    }): null
                }).catch(err => {
                    console.log(err)
                    callback(validations.validateDBUpdateQueryError(err));
                })
            } else {
                return callback? callback({
                    code: 500, 
                    status: 'INTERNAL ERROR',
                    message: `Could not find course = ${data.sem_course_id}`
                }) : null
            }
        }).catch(err => {
            console.log(err)
            callback(validations.validateDBSelectQueryError(err));
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
    studentsCoursesUpdateMarkings,
    studentsCoursesUpdateAttendances,
    StudentsCourses
}