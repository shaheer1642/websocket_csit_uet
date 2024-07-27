const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData, isBase64 } = require('../modules/validator');
const { body, param, check, query } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { validateGradeDistribution } = require('../modules/validations');
const { uploadFile } = require('../modules/aws/aws');
const { escapeDBCharacters, getDepartmentIdFromCourseId } = require('../modules/functions');

// class Courses {
//     name = 'Courses';
//     description = 'Endpoints for creating courses'
//     data_types = {
//         course_id: new DataTypes(true, ['courses/create', 'courses/update', 'courses/delete'], ['courses/fetch'], false, 'CS-103').string,
//         course_name: new DataTypes(true, ['courses/create'], ['courses/update'], false, 'Algorithms').string,
//         course_description: new DataTypes(true, [], ['courses/create', 'courses/update'], true).string,
//         department_id: new DataTypes(true, [], [], false, 'CS&IT').string,
//         course_type: new DataTypes(true, ['courses/create'], ['courses/update'], false, 'core').string,
//         credit_hours: new DataTypes(true, ['courses/create'], ['courses/update'], false, 3).number,
//         course_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
//     }
// }

router.get('/semestersCourses',
    (req, res, next) => validateData([
        query('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('course_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('teacher_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('semester_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        var where_clauses = []
        if (data.sem_course_id) where_clauses.push(`SC.sem_course_id = '${data.sem_course_id}'`)
        if (data.course_id) where_clauses.push(`SC.course_id = '${data.course_id}'`)
        if (data.teacher_id) where_clauses.push(`SC.teacher_id = '${data.teacher_id}'`)
        if (data.semester_id) where_clauses.push(`SC.semester_id = '${data.semester_id}'`)
        db.query(`
            SELECT *, (SELECT COUNT(student_batch_id) AS registered_students FROM students_courses WHERE sem_course_id = SC.sem_course_id) FROM semesters_courses SC
            JOIN courses C ON C.course_id = SC.course_id
            JOIN departments D ON D.department_id = C.department_id
            JOIN teachers T ON T.teacher_id = SC.teacher_id
            JOIN semesters S ON S.semester_id = SC.semester_id
            ${where_clauses.length > 0 ? 'WHERE' : ''}
            ${where_clauses.join(' AND ')}
        `).then(db_res => {
            res.send(db_res.rows)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/semestersCourses',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        body('course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('teacher_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('semester_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.body }

        db.query(`
            INSERT INTO semesters_courses (course_id, teacher_id, semester_id) 
            VALUES (
                '${data.course_id}',
                '${data.teacher_id}',
                '${data.semester_id}'
            );
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Added successfully")
            else res.status(500).send(`Unexpected DB response. Added ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.patch('/semestersCourses/:sem_course_id/updateTeacher',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('teacher_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`
            UPDATE semesters_courses SET teacher_id = '${data.teacher_id}'
            WHERE sem_course_id = '${data.sem_course_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Deleted ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/semestersCourses/:sem_course_id/lockChanges',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`
            UPDATE semesters_courses SET changes_locked = true
            WHERE sem_course_id = '${data.sem_course_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Deleted ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/semestersCourses/:sem_course_id/lockGrades',
    passport.authenticate('jwt'), hasRole.bind(this, ['teacher']),
    (req, res, next) => validateData([
        param('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`
            SELECT * FROM students_courses SC
            JOIN semesters_courses SMC ON SC.sem_course_id = SMC.sem_course_id
            WHERE SC.sem_course_id = '${data.sem_course_id}' AND SMC.teacher_id = '${data.user_id}';
        `).then(db_res => {
            const studentsCourses = db_res.rows
            if (studentsCourses.length == 0) return res.status(400).send('Could not find required info')
            db.query('BEGIN;').then(() => {
                Promise.all(studentsCourses.filter(sc => sc.grade != 'W').map(studentCourse => {
                    return new Promise((resolve, reject) => {
                        fetch(process.env.SERVER_URL + `/api/studentsCourses/${studentCourse.student_batch_id}/${studentCourse.sem_course_id}/updateGrade`, {
                            method: 'PATCH',
                            headers: {
                                Authorization: `Bearer ${req.user.jwt_token}`
                            },
                            body: JSON.stringify({
                                grade: studentCourse.marking?.result[studentCourse?.grade_distribution?.marking?.type]?.grade,
                            })
                        }).then(r => {
                            if (r.status > 200) resolve()
                        }).catch(reject)
                        // studentsCoursesUpdateGrade({
                        //     event: 'studentsCourses/updateGrade',
                        //     user_id: data.user_id,
                        //     sem_course_id: studentCourse.sem_course_id,
                        //     student_batch_id: studentCourse.student_batch_id,
                        //     grade: studentCourse.marking?.result[studentCourse?.grade_distribution?.marking?.type]?.grade,
                        // }, (res) => {
                        //     res.code == 200 ? resolve(res) : reject(res)
                        // })
                    })
                })).then(() => {
                    db.query(`
                        UPDATE semesters_courses SET grades_locked = true
                        WHERE sem_course_id = '${data.sem_course_id}';
                    `).then(db_res => {
                        db.query('COMMIT;').catch(console.error)
                        if (db_res.rowCount == 1) return res.send('updated record in db')
                        else return res.status(500).send('unexpected DB response')
                    }).catch(err => {
                        db.query('ROLLBACK;').catch(console.error)
                        console.error(err)
                        return res.status(500).send(err.message || err.detail || JSON.stringify(err))
                    })
                }).catch(err => {
                    console.error(err)
                    db.query('ROLLBACK;').catch(console.error)
                    return res.status(500).send(err.message || err.detail || JSON.stringify(err))
                })
            }).catch(err => {
                console.error(err)
                return res.status(500).send(err.message || err.detail || JSON.stringify(err))
            })
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/semestersCourses/:sem_course_id/unlockGrades',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`
            UPDATE semesters_courses SET grades_locked = false
            WHERE sem_course_id = '${data.sem_course_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Deleted ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/semestersCourses/:sem_course_id/updateGradeDistribution',
    passport.authenticate('jwt'), hasRole.bind(this, ['teacher']),
    (req, res, next) => validateData([
        param('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('grade_distribution').isObject().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        const grade_distribution = data.grade_distribution
        const validation = validateGradeDistribution(grade_distribution)
        if (!validation.valid) {
            console.log(validation)
            return res.status(400).send(validation.reason)
        }

        db.query(`
            UPDATE semesters_courses 
            SET grade_distribution = '${JSON.stringify(grade_distribution)}'
            WHERE sem_course_id = '${data.sem_course_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) {
                // re-evaluate markings
                db.query(`
                        SELECT * FROM students_courses WHERE sem_course_id = '${data.sem_course_id}'
                    `).then(db_res => {
                    const attendances = db_res.rows.map(row => Object.keys(row.attendance).length > 0 ? row.attendance : null).filter(o => o != null)

                    fetch(process.env.SERVER_URL + `/api/studentsCourses/${data.sem_course_id}/updateAttendances`, {
                        method: 'PATCH',
                        headers: {
                            Authorization: `Bearer ${req.user.jwt_token}`
                        },
                        body: JSON.stringify({
                            attendances: attendances
                        })
                    }).then(r => {
                        if (r.status > 200) {
                            db.query(`
                                SELECT * FROM students_courses WHERE sem_course_id = '${data.sem_course_id}'
                            `).then(db_res => {
                                const markings = db_res.rows.map(row => Object.keys(row.marking).length > 0 ? row.marking : null).filter(o => o != null)

                                fetch(process.env.SERVER_URL + `/api/studentsCourses/${data.sem_course_id}/updateMarkings`, {
                                    method: 'PATCH',
                                    headers: {
                                        Authorization: `Bearer ${req.user.jwt_token}`
                                    },
                                    body: JSON.stringify({
                                        markings: markings
                                    })
                                }).then(r => {
                                    if (r.status > 200) {
                                        res.send(`updated ${data.sem_course_id} record in db`)
                                    } else {
                                        res.sendStatus(500)
                                    }
                                }).catch((err) => {
                                    console.error(err)
                                    res.sendStatus(500)
                                })

                                // studentsCoursesUpdateMarkings({ sem_course_id: data.sem_course_id, markings: markings, event: 'studentsCourses/updateMarkings' }, (res) => {
                                //     return callback ? callback({
                                //         code: 200,
                                //         status: 'OK',
                                //         message: `updated ${data.sem_course_id} record in db`
                                //     }) : null;
                                // })
                            })
                        } else {
                            res.sendStatus(500)
                        }
                    }).catch((err) => {
                        console.error(err)
                        res.sendStatus(500)
                    })

                    // studentsCoursesUpdateAttendances({ sem_course_id: data.sem_course_id, attendances: attendances, event: 'studentsCourses/updateAttendances' }, (res) => {
                    //     db.query(`
                    //         SELECT * FROM students_courses WHERE sem_course_id = '${data.sem_course_id}'
                    //     `).then(res => {
                    //         const markings = res.rows.map(row => Object.keys(row.marking).length > 0 ? row.marking : null).filter(o => o != null)
                    //         studentsCoursesUpdateMarkings({ sem_course_id: data.sem_course_id, markings: markings, event: 'studentsCourses/updateMarkings' }, (res) => {
                    //             return callback ? callback({
                    //                 code: 200,
                    //                 status: 'OK',
                    //                 message: `updated ${data.sem_course_id} record in db`
                    //             }) : null;
                    //         })
                    //     })
                    // })
                })
            } else if (db_res.rowCount == 0) {
                res.status(400).send(`record ${data.sem_course_id} does not exist`)
            } else {
                res.status(500).send(`${res.rowCount} rows updated`)
            }
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.delete('/semestersCourses/:sem_course_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.params

        db.query(`
            DELETE FROM semesters_courses WHERE sem_course_id='${data.sem_course_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Deleted successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Deleted ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

module.exports = router