const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class StudentsCourses {
    name = 'Student Course Registration';
    description = 'Endpoints for assigning courses to students'
    data_types = {
        course_id: new DataTypes(true,
            ['students_courses/create','students_courses/updateTeacher','students_courses/updateGrade','students_courses/delete'],
            ['students_courses/fetch']).string,
        student_id: new DataTypes(true,
            ['students_courses/create','students_courses/updateGrade','students_courses/delete'],
            ['students_courses/fetch']).uuid,
        teacher_id: new DataTypes(true,
            ['students_courses/create','students_courses/updateTeacher'],
            ['students_courses/fetch']).uuid,
        semester_id: new DataTypes(true,
            ['students_courses/create'],
            ['students_courses/fetch']).uuid,
        grade: new DataTypes(true,
            ['students_courses/updateGrade'],
            ['students_courses/fetch'],false,'B').string,
        course_completion_timestamp: new DataTypes(true,
            ['students_courses/updateGrade']).unix_timestamp_milliseconds,
    }
}

function studentsCoursesFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Courses,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.course_id) where_clauses.push(`course_id = '${data.course_id}'`)
        if (data.student_id) where_clauses.push(`student_id = '${data.course_id}'`)
        if (data.teacher_id) where_clauses.push(`teacher_id = '${data.teacher_id}'`)
        if (data.semester_id) where_clauses.push(`semester_id = '${data.semester_id}'`)
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

function studentsCoursesCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Courses,data.event)
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
            INSERT INTO students_courses (course_id, student_id, teacher_id, semester_id) 
            VALUES (
                '${data.course_id}',
                '${data.student_id}',
                '${data.teacher_id}',
                '${data.semester_id}'
            );
        `).then(res => {
            if (!callback) return
            if (res.rowCount == 1) {
                callback({
                    code: 200, 
                    status: 'OK',
                    message: 'added record to db'
                });
            } else {
                callback({
                    code: 500, 
                    status: 'INTERNAL ERROR',
                    message: 'unexpected DB response'
                });
            }
        }).catch(err => {
            console.log(err)
            if (callback) {
                callback(validations.validateDBInsertQueryError(err));
            }
        })
    }
}

function studentsCoursesDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Courses,data.event)
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
            DELETE FROM students_courses WHERE course_id='${data.course_id}' AND student_id='${data.student_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `deleted course=${data.course_id} student=${data.student_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record course=${data.course_id} student=${data.student_id} does not exist`
                    });
                }
            } else {
                if (callback) {
                    callback({
                        code: 500, 
                        status: 'INTERNAL ERROR',
                        message: `${res.rowCount} rows deleted`
                    });
                }
            }
        }).catch(err => {
            console.log(err)
            if (callback) {
                callback(validations.validateDBDeleteQueryError(err));
            }
        })
    }
}

function studentsCoursesUpdateTeacher(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Courses,data.event)
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
        if (data.teacher_id) update_clauses.push(`teacher_id = '${data.teacher_id}'`)
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
            ${update_clauses.join(',')}
            WHERE course_id = '${data.course_id}';
        `).then(res => {
            if (res.rowCount > 0) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated ${data.course_id} record in db. ${res.rowCount} rows updated`
                    });
                }
            } else {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.course_id} does not exist`
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

function studentsCoursesUpdateGrade(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Courses,data.event)
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
            ${update_clauses.join(',')}
            WHERE course_id = '${data.course_id}' AND student_id = '${data.student_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated course=${data.course_id} student=${data.student_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record course=${data.course_id} student=${data.student_id} does not exist`
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
    
    if (notification.channel == 'students_courses_insert') {
        event_emitter.emit('notifyAll', {event: 'students_courses/listener/insert', data: payload})
    }
    if (notification.channel == 'students_courses_update') {
        event_emitter.emit('notifyAll', {event: 'students_courses/listener/update', data: payload[0]})
    }
    if (notification.channel == 'students_courses_delete') {
        event_emitter.emit('notifyAll', {event: 'students_courses/listener/delete', data: payload})
    }
})

module.exports = {
    studentsCoursesFetch,
    studentsCoursesCreate,
    studentsCoursesDelete,
    studentsCoursesUpdateTeacher,
    studentsCoursesUpdateGrade,
    StudentsCourses
}