const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData } = require('../modules/validator');
const { body, param, query } = require('express-validator')
const { hasRole } = require('../modules/auth')
const passport = require('passport');
const { generateRandom1000To9999, formatCNIC } = require('../modules/functions');
const { hashPassword } = require('../modules/hashing');
const { calculateTranscript } = require('../modules/grading_functions');

router.get('/students',
    passport.authenticate('jwt'),
    (req, res, next) => validateData([
        query('user_department_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('student_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const user = req.user
        const data = req.query

        var where_clauses = []
        if (data.student_batch_id) where_clauses.push(`SB.student_batch_id = '${data.student_batch_id}'`)
        if (data.batch_id) where_clauses.push(`B.batch_id = '${data.batch_id}'`)
        if (data.student_id) where_clauses.push(`S.student_id = '${data.student_id}'`)
        if (data.reg_no) where_clauses.push(`S.reg_no = '${data.reg_no.toLowerCase()}'`)
        if (data.cnic) where_clauses.push(`S.cnic = '${data.cnic}'`)
        where_clauses.push(`U.user_department_id = '${user.user_department_id || data.user_department_id}'`)

        db.query(`
            SELECT 
                S.*,
                SB.*, 
                B.*, 
                U.*, 
                (SELECT SUM(C.credit_hours) FROM students_courses SC JOIN semesters_courses SMC on SMC.sem_course_id = SC.sem_course_id JOIN courses C on C.course_id = SMC.course_id WHERE SC.student_batch_id = SB.student_batch_id AND SC.is_repeat = false) AS total_credit_hours,
                (SELECT COUNT(C.course_id) FROM students_courses SC JOIN semesters_courses SMC on SMC.sem_course_id = SC.sem_course_id JOIN courses C on C.course_id = SMC.course_id WHERE SC.student_batch_id = SB.student_batch_id AND SC.is_repeat = false AND C.course_type = 'core') AS total_core_courses,
                (SELECT COUNT(C.course_id) FROM students_courses SC JOIN semesters_courses SMC on SMC.sem_course_id = SC.sem_course_id JOIN courses C on C.course_id = SMC.course_id WHERE SC.student_batch_id = SB.student_batch_id AND SC.is_repeat = false AND C.course_type = 'elective') AS total_elective_courses
            FROM students S
            JOIN students_batch SB on SB.student_id = S.student_id
            JOIN batches B on B.batch_id = SB.batch_id
            JOIN users U ON U.user_id = S.student_id
            ${where_clauses.length > 0 ? 'WHERE' : ''}
            ${where_clauses.join(' AND ')}
            ORDER BY B.batch_no DESC;
        `).then(db_res => {
            console.log(db_res.rows)
            res.send(db_res.rows)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.get('/students/:student_batch_id/transcript',
    passport.authenticate('jwt'),
    (req, res, next) => validateData([
        param('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`)
    ], req, res, next),
    (req, res) => {
        const data = req.query

        db.query(`
            SELECT * FROM students_courses SDC
            JOIN semesters_courses SMC ON SMC.sem_course_id = SDC.sem_course_id
            JOIN semesters SM ON SM.semester_id = SMC.semester_id
            JOIN students_batch SDB ON SDB.student_batch_id = SDC.student_batch_id
            JOIN batches B ON SDB.batch_id = B.batch_id
            JOIN students S ON S.student_id = SDB.student_id
            JOIN courses C ON C.course_id = SMC.course_id
            JOIN grades G ON SDC.grade = G.grade
            WHERE SDC.student_batch_id = '${data.student_batch_id}'
            ORDER BY SM.semester_start_timestamp ASC;
            SELECT * FROM students_thesis WHERE student_batch_id = '${data.student_batch_id}';
        `).then(res => {
            if (res[0].rowCount == 0) return res.send('No courses assigned yet')
            const courses = res[0].rows
            const thesis = res[1].rows[0]
            const data = courses[0]
            const attributes = {
                reg_no: data.reg_no,
                cnic: data.cnic,
                student_name: data.student_name,
                student_father_name: data.student_father_name,
                degree_type: data.degree_type,
                department: `Computer Science & Information Technology`,
                specialization: convertUpper(data.batch_stream),
                thesis_title: data.thesis_title,
                thesis_grade: data.thesis_grade
            }
            const { semestersCourses, gpa } = calculateTranscript(courses)
            return res.send({
                thesis,
                attributes,
                semestersCourses,
                gpa
            })
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/students',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        body('student_name').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('student_father_name').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('cnic').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('reg_no').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('student_gender').isString().isIn(['male', 'female']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('student_admission_status').isString().isIn(['open_merit', 'rationalized', 'afghan_student']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('student_contact_no').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('student_address').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('user_email').isEmail().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional()
    ], req, res, next),
    async (req, res) => {
        const user = req.user
        const data = req.body
        console.log('post students department id', data)

        if (!data.cnic && !data.reg_no) return res.status(400).send('Both CNIC and Reg No cannot be empty')
        data.cnic = data.cnic?.toString().toLowerCase()
        data.reg_no = data.reg_no?.toString().toLowerCase()
        if (data.cnic) {
            data.cnic = formatCNIC(data.cnic)
            if (!data.cnic) return res.status(400).send('CNIC must be exactly 13 characters long')
        }
        const default_password = generateRandom1000To9999()
        db.query(`
            WITH query_one AS ( 
                INSERT INTO users (username, password, default_password, user_type, user_email, user_department_id) 
                VALUES (
                    '${data.reg_no || data.cnic}',
                    '${hashPassword(default_password)}',
                    '${default_password}',
                    'student',
                    ${data.user_email ? `'${data.user_email}'` : null},
                    '${user.user_department_id}'
                ) 
                RETURNING user_id 
            ), query_two AS (
                INSERT INTO students (student_id, cnic, reg_no, student_name, student_father_name, student_gender, student_admission_status, student_address, student_contact_no) 
                VALUES (
                    ( select user_id from query_one ),
                    ${data.cnic ? `'${data.cnic}'` : null},
                    ${data.reg_no ? `'${data.reg_no}'` : null},
                    '${data.student_name}',
                    '${data.student_father_name}',
                    ${data.student_gender ? `'${data.student_gender.toLowerCase()}'` : null},
                    ${data.student_admission_status ? `'${data.student_admission_status.toLowerCase()}'` : null},
                    ${data.student_address ? `'${data.student_address}'` : null},
                    ${data.student_contact_no ? `'${data.student_contact_no}'` : null}
                )
            )
            INSERT INTO students_batch (student_id, batch_id)
            VALUES (
                ( select user_id from query_one ),
                '${data.batch_id}'
            );
        `).then(db_res => {
            if (db_res.rowCount == 1) return res.send('added record to db')
            else return res.status(500).send('unexpected DB response')
        }).catch(err => {
            if (err.code == '23505' && (err.constraint == 'students_cnic_ukey' || err.constraint == 'students_reg_no_ukey' || err.constraint == 'users_ukey2')) {
                db.query(`
                    INSERT INTO students_batch (student_id, batch_id)
                    VALUES (
                        ( select student_id from students WHERE cnic = '${data.cnic}' OR reg_no = '${data.reg_no}'),
                        '${data.batch_id}'
                    );
                `).then(db_res => {
                    if (db_res.rowCount == 1) return res.send('added record to db')
                    else return res.status(500).send('unexpected DB response')
                }).catch(err => {
                    console.error(err)
                    res.status(500).send(err.detail || err.message || JSON.stringify(err))
                })
            } else {
                console.error(err)
                res.status(500).send(err.detail || err.message || JSON.stringify(err))
            }
        })
    }
)

router.post('/students/:student_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('student_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        // param('batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('cnic').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('reg_no').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('student_name').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('student_father_name').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('student_gender').isString().isIn(['male', 'female']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('student_admission_status').isString().isIn(['open_merit', 'rationalized', 'afghan_student']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('student_contact_no').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('student_address').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('user_email').isEmail().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional()
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        if (data.cnic) {
            data.cnic = formatCNIC(data.cnic)
            if (!data.cnic) return res.status(400).send('CNIC must be exactly 13 characters long')
        }

        var update_clauses = []
        if (data.reg_no != undefined) update_clauses.push(`reg_no = ${data.reg_no ? `'${data.reg_no.toLowerCase()}'` : 'NULL'}`)
        if (data.cnic != undefined) update_clauses.push(`cnic = ${data.cnic ? `'${data.cnic}'` : 'NULL'}`)
        if (data.student_name) update_clauses.push(`student_name = '${data.student_name}'`)
        if (data.student_father_name) update_clauses.push(`student_father_name = '${data.student_father_name}'`)
        if (data.student_address != undefined) update_clauses.push(`student_address = ${data.student_address ? `'${data.student_address}'` : 'NULL'}`)
        if (data.student_contact_no != undefined) update_clauses.push(`student_contact_no = ${data.student_contact_no ? `'${data.student_contact_no}'` : 'NULL'}`)
        if (data.student_gender != undefined) update_clauses.push(`student_gender = ${data.student_gender ? `'${data.student_gender}'` : 'NULL'}`)
        if (data.student_admission_status != undefined) update_clauses.push(`student_admission_status = ${data.student_admission_status ? `'${data.student_admission_status}'` : 'NULL'}`)
        if (update_clauses.length == 0) return res.status(400).send(`No valid parameters found in requested data.`)

        db.query(
            data.cnic || data.reg_no ?
                `WITH query_one AS ( 
                UPDATE students SET
                ${update_clauses.join(',')}
                WHERE student_id = '${data.student_id}'
                RETURNING reg_no, cnic
            )
            UPDATE users SET 
            username = ( select COALESCE(reg_no, cnic) from query_one ) 
            ${data.user_email ? `,user_email = '${data.user_email}'` : ''} 
            WHERE user_id = '${data.student_id}';`
                :
                `UPDATE students SET
            ${update_clauses.join(',')}
            WHERE student_id = '${data.student_id}';`
        ).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/students/:student_batch_id/completeDegree',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('degree_completed').isBoolean().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`)
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        db.query(`
            UPDATE students_batch SET
            degree_completed = ${data.degree_completed}
            WHERE student_batch_id = '${data.student_batch_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/students/:student_batch_id/extendDegreeTime',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('degree_extension_period').isObject().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`)
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        if (!data.degree_extension_period.period && !data.degree_extension_period.reason) return res.status(400).send('Missing period or reason')
        data.degree_extension_period.period = Number(data.degree_extension_period.period)
        if (!data.degree_extension_period.period) return res.status(400).send('Invalid type for period')

        db.query(`
            UPDATE students_batch SET
            degree_extension_periods = degree_extension_periods || '${JSON.stringify(data.degree_extension_period)}'
            WHERE student_batch_id = '${data.student_batch_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/students/:student_batch_id/freezeSemester',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('semester_frozen').isBoolean().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`)
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        db.query(`
            UPDATE students_batch SET
            semester_frozen = ${data.semester_frozen}
            WHERE student_batch_id = '${data.student_batch_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/students/:student_batch_id/cancelAdmission',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('admission_cancelled').isBoolean().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`)
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        db.query(`
            UPDATE students_batch SET
            admission_cancelled = ${data.admission_cancelled}
            WHERE student_batch_id = '${data.student_batch_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.delete('/students/:student_id/:batch_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('student_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        param('batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.params

        db.query(`
            SELECT * FROM students_batch WHERE student_id = '${data.student_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1 && db_res.rows.some(row => row.batch_id == data.batch_id)) {
                db.query(`
                    DELETE FROM users WHERE user_id='${data.student_id}';
                `).then(db_res => {
                    if (db_res.rowCount == 1) return res.send(`deleted ${data.student_id} record from db`);
                    else if (db_res.rowCount == 0) return res.status(400).send(`record ${data.student_id} does not exist`);
                    else return res.status(500).send(`${res.rowCount} rows deleted`);
                }).catch(err => {
                    console.error(err)
                    res.status(500).send(err.message || err.detail || JSON.stringify(err))
                })
            } else if (db_res.rowCount > 1) {
                db.query(`
                    DELETE FROM students_batch WHERE student_id='${data.student_id}' AND batch_id='${data.batch_id}';
                `).then(db_res => {
                    if (db_res.rowCount == 1) return res.send(`deleted student_id=${data.student_id} batch_id=${data.batch_id} record from db`);
                    else if (db_res.rowCount == 0) return res.status(400).send(`record student_id=${data.student_id} batch_id=${data.batch_id} does not exist`);
                    else return res.status(500).send(`${res.rowCount} rows deleted`);
                }).catch(err => {
                    console.error(err)
                    res.status(500).send(err.message || err.detail || JSON.stringify(err))
                })
            } else return res.status(500).send(`Could not find that user`);
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

module.exports = router
