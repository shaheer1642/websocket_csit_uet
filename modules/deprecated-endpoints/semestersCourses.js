const db = require('../db');
const uuid = require('uuid');
const validations = require('../validations');
const { DataTypes } = require('../classes/DataTypes')
const { event_emitter } = require('../event_emitter')
const { studentsCoursesUpdateMarkings, studentsCoursesUpdateAttendances, studentsCoursesUpdateGrade } = require('./studentsCourses')
const { checkKeysExists } = require('../functions')

class SemestersCourses {
    name = 'Semesters Courses';
    description = 'Endpoints for creating semester courses'
    data_types = {
        sem_course_id: new DataTypes(true, ['semestersCourses/updateTeacher', 'semestersCourses/updateGradeDistribution', 'semestersCourses/delete', 'semestersCourses/lockChanges', 'semestersCourses/lockGrades', 'semestersCourses/unlockGrades'], ['semestersCourses/fetch']).uuid,
        course_id: new DataTypes(true, ['semestersCourses/create'], ['semestersCourses/fetch'], false, 'CS-103').string,
        teacher_id: new DataTypes(true, ['semestersCourses/create', 'semestersCourses/updateTeacher'], ['semestersCourses/fetch']).uuid,
        semester_id: new DataTypes(true, ['semestersCourses/create'], ['semestersCourses/fetch']).uuid,
        grade_distribution: new DataTypes(true, ['semestersCourses/updateGradeDistribution'], [], false, '{"finals": 50, "mids": 30, "sessional": 20, "assignments_distribution": [5,5,5], "quizzes_distribution": [5,5,5], "mini_project_distribution": 0}').json,
        changes_locked: new DataTypes(true, [], []).boolean,
        grades_locked: new DataTypes(true, [], []).boolean,
    }
}

function semestersCoursesFetch(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    if (!callback) return
    const validator = validations.validateRequestData(data, new SemestersCourses, data.event)
    if (!validator.valid) {
        callback({
            code: 400,
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.sem_course_id) where_clauses.push(`SC.sem_course_id = '${data.sem_course_id}'`)
        if (data.course_id) where_clauses.push(`SC.course_id = '${data.course_id}'`)
        if (data.teacher_id) where_clauses.push(`SC.teacher_id = '${data.teacher_id}'`)
        if (data.semester_id) where_clauses.push(`SC.semester_id = '${data.semester_id}'`)
        db.query(`
            SELECT *, (SELECT COUNT(student_batch_id) AS registered_students FROM students_courses WHERE sem_course_id = SC.sem_course_id) FROM semesters_courses SC
            JOIN courses C ON C.course_id = SC.course_id
            JOIN departments D ON D.department_id = C.course_department_id
            JOIN teachers T ON T.teacher_id = SC.teacher_id
            JOIN semesters S ON S.semester_id = SC.semester_id
            ${where_clauses.length > 0 ? 'WHERE' : ''}
            ${where_clauses.join(' AND ')}
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

function semestersCoursesCreate(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    const validator = validations.validateRequestData(data, new SemestersCourses, data.event)
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
            INSERT INTO semesters_courses (course_id, teacher_id, semester_id) 
            VALUES (
                '${data.course_id}',
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
            console.error(err)
            if (callback) {
                callback(validations.validateDBInsertQueryError(err));
            }
        })
    }
}

function semestersCoursesDelete(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    const validator = validations.validateRequestData(data, new SemestersCourses, data.event)
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
            DELETE FROM semesters_courses WHERE sem_course_id='${data.sem_course_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200,
                        status: 'OK',
                        message: `deleted ${data.sem_course_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400,
                        status: 'BAD REQUEST',
                        message: `record ${data.sem_course_id} does not exist`
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
            console.error(err)
            if (callback) {
                callback(validations.validateDBDeleteQueryError(err));
            }
        })
    }
}

function semestersCoursesUpdateTeacher(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    const validator = validations.validateRequestData(data, new SemestersCourses, data.event)
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
        db.query(`
            UPDATE semesters_courses SET teacher_id = '${data.teacher_id}'
            WHERE sem_course_id = '${data.sem_course_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200,
                        status: 'OK',
                        message: `updated ${data.sem_course_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400,
                        status: 'BAD REQUEST',
                        message: `record ${data.sem_course_id} does not exist`
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
            console.error(err)
            if (callback) {
                callback(validations.validateDBUpdateQueryError(err));
            }
        })
    }
}

function semestersCoursesLockChanges(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    const validator = validations.validateRequestData(data, new SemestersCourses, data.event)
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
            UPDATE semesters_courses SET changes_locked = true
            WHERE sem_course_id = '${data.sem_course_id}';
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
            console.error(err)
            if (callback) {
                callback(validations.validateDBInsertQueryError(err));
            }
        })
    }
}

function semestersCoursesUnlockGrades(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new SemestersCourses, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        UPDATE semesters_courses SET grades_locked = false
        WHERE sem_course_id = '${data.sem_course_id}';
    `).then(res => {
        if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'added record to db' });
        else return callback({ code: 500, status: 'INTERNAL ERROR', message: 'unexpected DB response' });
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBInsertQueryError(err));
    })
}

function semestersCoursesLockGrades(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new SemestersCourses, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        SELECT * FROM students_courses SC
        JOIN semesters_courses SMC ON SC.sem_course_id = SMC.sem_course_id
        WHERE SC.sem_course_id = '${data.sem_course_id}' AND SMC.teacher_id = '${data.user_id}';
    `).then(res => {
        const studentsCourses = res.rows
        if (studentsCourses.length == 0) return callback({ code: 400, status: 'BAD REQUEST', message: 'Could not find required info' });
        db.query('BEGIN;').then(() => {
            Promise.all(studentsCourses.filter(sc => sc.grade != 'W').map(studentCourse => {
                return new Promise((resolve, reject) => {
                    studentsCoursesUpdateGrade({
                        event: 'studentsCourses/updateGrade',
                        user_id: data.user_id,
                        sem_course_id: studentCourse.sem_course_id,
                        student_batch_id: studentCourse.student_batch_id,
                        grade: studentCourse.marking?.result[studentCourse?.grade_distribution?.marking?.type]?.grade,
                    }, (res) => {
                        res.code == 200 ? resolve(res) : reject(res)
                    })
                })
            })).then((responses) => {
                db.query(`
                    UPDATE semesters_courses SET grades_locked = true
                    WHERE sem_course_id = '${data.sem_course_id}';
                `).then(res => {
                    db.query('COMMIT;').catch(console.error)
                    if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'updated record in db' });
                    else return callback({ code: 500, status: 'INTERNAL ERROR', message: 'unexpected DB response' });
                }).catch(err => {
                    db.query('ROLLBACK;').catch(console.error)
                    console.error(err)
                    return callback(validations.validateDBInsertQueryError(err));
                })
            }).catch(err => {
                console.error(err)
                db.query('ROLLBACK;').catch(console.error)
                return callback(err);
            })
        }).catch(console.error)
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function validateGradeDistribution(grade_distribution) {
    const template = {
        marking: {
            type: 'relative',
            average_top: 10
        },
        final_term: {
            weightage: 50,
            total_marks: 50
        },
        mid_term: {
            weightage: 25,
            total_marks: 25
        },
        sessional: {
            weightage: 25,
            division: {
                attendance: {
                    include: true,
                    total_marks: 10
                },
                assignments: {
                    include: true,
                    no_of_assignments: 3,
                    total_marks_per_assignment: 5
                },
                quizzes: {
                    include: true,
                    no_of_quizzes: 3,
                    total_marks_per_quiz: 5
                },
                class_participation: {
                    include: false,
                    total_marks: 10
                },
                presentation: {
                    include: false,
                    total_marks: 10
                },
                semester_project: {
                    include: false,
                    total_marks: 10
                },
                research_paper: {
                    include: false,
                    total_marks: 10
                },
                case_study: {
                    include: false,
                    total_marks: 10
                },
            }
        }
    }

    if (!checkKeysExists(grade_distribution, template)) {
        return {
            valid: false,
            reason: `Invalid parameter type for attribute grade_distribution`
        };
    }
    if (Number(grade_distribution.final_term.weightage + grade_distribution.mid_term.weightage + grade_distribution.sessional.weightage) != 100) {
        return {
            valid: false,
            reason: `Total distribution must not be less or higher than 100%`
        };
    }
    return {
        valid: true,
    }
}

function semestersCoursesUpdateGradeDistribution(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    const validator = validations.validateRequestData(data, new SemestersCourses, data.event)
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
        const grade_distribution = data.grade_distribution
        const validation = validateGradeDistribution(grade_distribution)
        if (!validation.valid) {
            console.log(validation)
            return callback({
                code: 400,
                status: 'BAD REQUEST',
                message: validation.reason
            });
        }
        db.query(`
            UPDATE semesters_courses 
            SET grade_distribution = '${JSON.stringify(grade_distribution)}'
            WHERE sem_course_id = '${data.sem_course_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    // re-evaluate markings
                    db.query(`
                        SELECT * FROM students_courses WHERE sem_course_id = '${data.sem_course_id}'
                    `).then(res => {
                        const attendances = res.rows.map(row => Object.keys(row.attendance).length > 0 ? row.attendance : null).filter(o => o != null)
                        studentsCoursesUpdateAttendances({ sem_course_id: data.sem_course_id, attendances: attendances, event: 'studentsCourses/updateAttendances' }, (res) => {
                            db.query(`
                                SELECT * FROM students_courses WHERE sem_course_id = '${data.sem_course_id}'
                            `).then(res => {
                                const markings = res.rows.map(row => Object.keys(row.marking).length > 0 ? row.marking : null).filter(o => o != null)
                                studentsCoursesUpdateMarkings({ sem_course_id: data.sem_course_id, markings: markings, event: 'studentsCourses/updateMarkings' }, (res) => {
                                    return callback ? callback({
                                        code: 200,
                                        status: 'OK',
                                        message: `updated ${data.sem_course_id} record in db`
                                    }) : null;
                                })
                            })
                        })
                    })
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400,
                        status: 'BAD REQUEST',
                        message: `record ${data.sem_course_id} does not exist`
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
            console.error(err)
            if (callback) {
                callback(validations.validateDBUpdateQueryError(err));
            }
        })
    }
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);

    if (['semesters_courses_insert', 'semesters_courses_update', 'semesters_courses_delete'].includes(notification.channel)) {
        event_emitter.emit('notifyAll', { event: 'semestersCourses/listener/changed', data: payload[0] || payload })
    }
})

module.exports = {
    semestersCoursesFetch,
    semestersCoursesCreate,
    semestersCoursesDelete,
    semestersCoursesUpdateTeacher,
    semestersCoursesUpdateGradeDistribution,
    semestersCoursesLockChanges,
    semestersCoursesLockGrades,
    semestersCoursesUnlockGrades,
    SemestersCourses
}