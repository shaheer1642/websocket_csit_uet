const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData, isBase64 } = require('../modules/validator');
const { body, param, check, query } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { validateApplicationTemplateDetailStructure } = require('../modules/validations');
const { uploadFile } = require('../modules/aws/aws');
const { escapeDBCharacters, getDepartmentIdFromCourseId } = require('../modules/functions');
const { markingEvalutation, calculateAttendancePercentage } = require('../modules/grading_functions');

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

router.get('/studentsCourses',
    (req, res, next) => validateData([
        query('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('grade').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        var where_clauses = []
        if (data.sem_course_id) where_clauses.push(`SC.sem_course_id = '${data.sem_course_id}'`)
        if (data.student_batch_id) where_clauses.push(`SC.student_batch_id = '${data.student_batch_id}'`)
        if (data.semester_id) where_clauses.push(`SMC.semester_id = '${data.semester_id}'`)
        if (data.grade) where_clauses.push(`SC.grade = '${data.grade}'`)

        db.query(`
            SELECT * FROM students_courses SC
            JOIN semesters_courses SMC ON SMC.sem_course_id = SC.sem_course_id
            JOIN courses C ON C.course_id = SMC.course_id
            JOIN departments D ON C.department_id = D.department_id
            JOIN semesters SM ON SM.semester_id = SMC.semester_id
            JOIN teachers T ON SMC.teacher_id = T.teacher_id
            JOIN students S ON S.student_id = (select student_id from students_batch where student_batch_id = SC.student_batch_id)
            ${where_clauses.length > 0 ? 'WHERE' : ''}
            ${where_clauses.join(' AND ')}
            ORDER BY SC.enrollment_timestamp ASC
        `).then(db_res => {
            res.send(db_res.rows)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

const default_objects = {
    students_courses_marking: { "quiz_1": 0, "quiz_2": 0, "quiz_3": 0, "result": { "absolute": { "grade": "N", "evaluation": { "mid_term": { "total": 25, "obtained": 0 }, "sessional": { "total": 25, "obtained": 0 }, "final_term": { "total": 50, "obtained": 0 } }, "percentage": 0, "total_marks": 100, "obtained_marks": 0 }, "relative": { "grade": "N", "evaluation": { "mid_term": { "total": 25, "obtained": 0 }, "sessional": { "total": 25, "obtained": 0 }, "final_term": { "total": 50, "obtained": 0 } }, "percentage": 0, "total_marks": 100, "obtained_marks": 0 } }, "mid_term": 0, "attendance": 0, "final_term": 0, "assignment_1": 0, "assignment_2": 0, "assignment_3": 0 },
    students_courses_attendance: { "week1": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week2": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week3": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week4": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week5": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week6": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week7": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week8": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week9": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week10": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week11": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week12": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week13": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week14": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week15": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "week16": { "classes": [{ "remarks": "", "cancelled": false, "timestamp": 1684840177930, "attendance": "" }] }, "percentage": 0 }
}

router.patch('/studentsCourses/:sem_course_id/assignStudents',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('student_batch_ids').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        const sem_course_id = data.sem_course_id
        db.query(`
            SELECT * FROM semesters_courses WHERE sem_course_id = '${sem_course_id}';
            SELECT * from students_courses WHERE sem_course_id = '${sem_course_id}';
        `).then(db_res => {
            const semester_course = db_res[0].rows[0]
            if (semester_course.changes_locked) return res.status(400).send('The course is locked from changes')
            const db_students_batch_ids = db_res[1].rows.map(row => row.student_batch_id)
            const received_students_batch_ids = data.student_batch_ids
            const insert_queries = []
            const delete_queries = []
            received_students_batch_ids.forEach(student_batch_id => {
                if (!db_students_batch_ids.includes(student_batch_id)) {
                    insert_queries.push(`INSERT INTO students_courses (
                        sem_course_id, 
                        student_batch_id, 
                        is_repeat,
                        marking, 
                        attendance
                    ) 
                    VALUES (
                        '${sem_course_id}',
                        '${student_batch_id}',
                        (SELECT CASE WHEN (COUNT(SC.student_batch_id) > 0) THEN true ELSE false END AS counted 
                        FROM students_courses SC 
                        WHERE SC.student_batch_id = '${student_batch_id}' AND 
                            SC.sem_course_id IN (SELECT SMC.sem_course_id FROM semesters_courses SMC 
                            WHERE SMC.course_id = (SELECT course_id FROM semesters_courses WHERE sem_course_id = '${sem_course_id}'))
                        ),
                        '${JSON.stringify({ ...default_objects.students_courses_marking, student_batch_id: student_batch_id })}',
                        '${JSON.stringify({ ...default_objects.students_courses_attendance, student_batch_id: student_batch_id })}'
                    );`)
                }
            })
            db_students_batch_ids.forEach(student_batch_id => {
                if (!received_students_batch_ids.includes(student_batch_id)) {
                    delete_queries.push(`DELETE FROM students_courses WHERE sem_course_id='${sem_course_id}' AND student_batch_id='${student_batch_id}';`)
                }
            })
            if (insert_queries.length == 0 && delete_queries.length == 0) {
                return res.status(400).send('No changes were made')
            }
            db.query(`
                BEGIN;
                ${insert_queries.join('\n')}
                ${delete_queries.join('\n')}
                COMMIT;
            `).then(db_res => {
                res.send('updated records in db')
            }).catch(err => {
                console.error(err)
                db.query(`ROLLBACK;`).catch(console.error);
                res.status(500).send(err.detail || err.message || JSON.stringify(err))
            })
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.patch('/studentsCourses/:student_batch_id/:sem_course_id/updateGrade',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga', 'teacher']),
    (req, res, next) => validateData([
        param('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        param('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('grade').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`SELECT * FROM semesters_courses WHERE sem_course_id = '${data.sem_course_id}'`)
            .then(db_res => {
                if (db_res.rowCount != 1) return res.status(404).send(`Could not find course = ${data.sem_course_id}`)

                const semester_course = db_res.rows[0];
                if (semester_course.grades_locked) return res.status(400).send('The course is locked from changes')

                db.query(`
                UPDATE students_courses SC SET
                grade = '${data.grade}',
                grade_change_logs = grade_change_logs || '"${new Date().getTime()} ${data.user_id} ${data.grade}"'
                WHERE SC.sem_course_id = '${data.sem_course_id}' AND SC.student_batch_id = '${data.student_batch_id}' AND SC.grade != 'W' AND NOT (SELECT grades_locked FROM semesters_courses SMC WHERE SMC.sem_course_id = SC.sem_course_id);
            `).then(db_res => {
                    if (db_res.rowCount == 1) return res.send(`updated sem_course=${data.sem_course_id} student_batch_id=${data.student_batch_id} record in db`)
                    else if (db_res.rowCount == 0) return res.status(400).send(`grade may no longer be assignable for this student`)
                    else return res.status(500).send(`${res.rowCount} rows updated`)
                }).catch(err => {
                    console.error(err)
                    res.status(500).send(err.detail || err.message || JSON.stringify(err))
                })
            }).catch(err => {
                console.error(err)
                res.status(500).send(err.detail || err.message || JSON.stringify(err))
            })
    }
)

router.patch('/studentsCourses/:sem_course_id/updateMarkings',
    passport.authenticate('jwt'), hasRole.bind(this, ['teacher']),
    (req, res, next) => validateData([
        param('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('markings').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`
            SELECT * FROM semesters_courses WHERE sem_course_id = '${data.sem_course_id}';
            SELECT * FROM students_courses WHERE sem_course_id = '${data.sem_course_id}' AND grade != 'W';
        `).then(db_res => {
            if (db_res[0].rowCount != 1) return res.status(404).send(`Could not find course = ${data.sem_course_id}`)

            const semester_course = db_res[0].rows[0];
            const course_students = db_res[1].rows;
            const grade_distribution = semester_course.grade_distribution

            if (semester_course.grades_locked) return res.status(400).send('The course is locked from changes')
            if (course_students.some(student => !data.markings.map(e => e.student_batch_id).includes(student.student_batch_id))) return res.status(400).send('Missing data for a student')

            const update_queries = []
            markingEvalutation(grade_distribution, data.markings).forEach(marking => {
                update_queries.push(`UPDATE students_courses SET marking = '${JSON.stringify(marking)}' WHERE sem_course_id = '${data.sem_course_id}' AND student_batch_id = '${marking.student_batch_id}';`)
            })
            if (update_queries.length == 0) return res.status(400).send('No changes were made')

            db.query(`
                BEGIN;
                ${update_queries.join('\n')}
                COMMIT;
            `).then(db_res => {
                return res.send('updated records in db')
            }).catch(err => {
                console.error(err)
                db.query(`ROLLBACK;`).catch(console.error);
                res.status(500).send(err.detail || err.message || JSON.stringify(err))
            })
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.patch('/studentsCourses/:sem_course_id/updateAttendances',
    passport.authenticate('jwt'), hasRole.bind(this, ['teacher']),
    (req, res, next) => validateData([
        param('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('attendances').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`SELECT * FROM semesters_courses WHERE sem_course_id = '${data.sem_course_id}'`)
            .then(db_res => {
                if (db_res.rowCount != 1) return res.status(404).send(`Could not find course = ${data.sem_course_id}`)

                const semester_course = db_res.rows[0];
                const grade_distribution = semester_course.grade_distribution

                if (semester_course.grades_locked) return res.status(400).send('The course is locked from changes')

                const update_queries = []
                data.attendances.forEach(attendance => {
                    const percentage = calculateAttendancePercentage(attendance)
                    attendance = {
                        ...attendance,
                        percentage: percentage
                    }
                    update_queries.push(`UPDATE students_courses SET attendance = '${JSON.stringify(attendance)}', marking = marking || '{"attendance": ${Number((percentage / 100 * (grade_distribution.sessional.division.attendance.total_marks)).toFixed(1))}}' WHERE sem_course_id = '${data.sem_course_id}' AND student_batch_id = '${attendance.student_batch_id}';`)
                })
                if (update_queries.length == 0) return res.status(400).send('No changes were made')

                db.query(`
                    BEGIN;
                    ${update_queries.join('\n')}
                    COMMIT;
                `).then(db_res => {
                    return res.send('updated records in db')
                }).catch(err => {
                    console.error(err)
                    db.query(`ROLLBACK;`).catch(console.error);
                    res.status(500).send(err.detail || err.message || JSON.stringify(err))
                })
            }).catch(err => {
                console.error(err)
                res.status(500).send(err.detail || err.message || JSON.stringify(err))
            })
    }
)

module.exports = router