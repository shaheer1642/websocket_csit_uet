const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData, isBase64 } = require('../modules/validator');
const { body, param, check, query } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { validateApplicationTemplateDetailStructure } = require('../modules/validations');
const { uploadFile } = require('../modules/aws/aws');
const { convertUpper } = require('../modules/functions');

// class Autocomplete {
//     name = 'Autocomplete';
//     description = 'Endpoints for fetching data such as for select menus. The parameters and the data are very dynamic, and will change from time to time. Best to consult the back-end developer for any ambiguity or try testing by calling the endpoint'
//     data_types = {
//         exclude_user_types: new DataTypes(false, [], ['autocomplete/users'], false, JSON.stringify(['admin', 'teacher'])).array,
//         exclude_user_ids: new DataTypes(false, [], ['autocomplete/users'], false, JSON.stringify(['e670c3ea-f740-11ed-a9d6-0242ac110032', '7bce48da-f5c1-11ed-b0ba-0242ac110032'])).array,
//         include_roles: new DataTypes(false, [], ['autocomplete/teachers'], false, JSON.stringify(['chairman', 'semester_coordinator', 'batch_advisor'])).array,
//         examiner_type: new DataTypes(false, [], ['autocomplete/studentsThesisExaminers'], false, 'internal_examiner').string,
//     }
// }

router.get('/autocomplete/users',
    (req, res, next) => validateData([
        query('exclude_user_types').customSanitizer(v => v.split(',')).isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('exclude_user_ids').customSanitizer(v => v.split(',')).isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        db.query(`
            SELECT * FROM users WHERE user_type NOT IN ('student','teacher');
            SELECT * FROM users JOIN students on students.student_id = users.user_id;
            SELECT * FROM users JOIN teachers on teachers.teacher_id = users.user_id;
        `).then(db_res => {
            var users_list = []

            db_res[0].rows.concat(db_res[1].rows.concat(db_res[2].rows)).forEach(user => {
                users_list.push({
                    user_id: user.user_id,
                    name: user.student_name || user.teacher_name || user.user_type,
                    user_type: user.user_type
                })
            })

            if (data.exclude_user_types) users_list = users_list.filter(user => !data.exclude_user_types.includes(user.user_type))
            if (data.exclude_user_ids) users_list = users_list.filter(user => !data.exclude_user_ids.includes(user.user_id))

            return res.send(users_list.map(user => ({ id: user.user_id, label: user.name })))
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)


router.get('/autocomplete/teachers',
    (req, res, next) => validateData([
        query('include_roles').customSanitizer(v => v.split(',')).isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query
        console.log(data)
        db.query(`
            SELECT 
            T.*,
            (SELECT department_id AS chairman FROM departments WHERE chairman_id = T.teacher_id) ,
            (SELECT 'Batch '||batch_no||' '||degree_type||' '||batch_stream AS batch_advisor FROM batches WHERE batch_advisor_id = T.teacher_id limit 1),
            (SELECT CASE WHEN semester_coordinator_id = T.teacher_id THEN semester_season::text||' '||semester_year END AS semester_coordinator FROM semesters ORDER BY semester_start_timestamp DESC limit 1)
            FROM teachers T;
        `).then(db_res => {
            res.send(db_res.rows.map(row => ({
                id: row.teacher_id,
                label: `${row.teacher_name}${row.chairman && data.include_roles?.includes('chairman') ? ` (Chairman - ${row.chairman})` : ''}${row.batch_advisor && data.include_roles?.includes('batch_advisor') ? ` (Batch Advisor - ${row.batch_advisor.split(' ').map(str => convertUpper(str)).join(' ')})` : ''}${row.semester_coordinator && data.include_roles?.includes('semester_coordinator') ? ` (Semester Coordinator - ${row.semester_coordinator.split(' ').map(str => convertUpper(str)).join(' ')})` : ''}`
            })))
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.get('/autocomplete/faculty',
    (req, res) => {
        db.query(`
            SELECT * FROM users WHERE username = 'admin' OR username = 'pga';
        `).then(db_res => {
            res.send([...db_res.rows.map(row => ({ id: row.user_id, label: row.username }))])
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.get('/autocomplete/courses',
    (req, res) => {
        db.query(`
            SELECT * FROM courses;
        `).then(db_res => {
            res.send(db_res.rows.map(row => ({ id: row.course_id, label: `${row.course_id} ${row.course_name}` })))
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.get('/autocomplete/departments',
    (req, res) => {
        db.query(`
            SELECT * FROM departments;
        `).then(db_res => {
            res.send(db_res.rows.map(row => ({ id: row.department_id, label: `${row.department_name}` })))
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.get('/autocomplete/batchStudents',
    (req, res, next) => validateData([
        query('batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('constraints').customSanitizer(v => v.split(',')).isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

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
            ${where_clauses.length > 0 ? `WHERE ` : ''}
            ${where_clauses.join(' AND ')}
            ORDER BY S.student_name;
        `).then(db_res => {
            res.send(db_res.rows.map(row => ({ id: row.student_batch_id, label: `${row.student_name} SD/o ${row.student_father_name} (${row.reg_no || row.cnic}) - ${convertUpper(row.degree_type)}` })))
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.get('/autocomplete/studentsThesisExaminers',
    (req, res, next) => validateData([
        query('examiner_type').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional()
    ], req, res, next),
    (req, res) => {
        const data = req.query

        const where_clauses = []
        if (data.examiner_type) where_clauses.push(`examiner_type = '${data.examiner_type}'`)

        db.query(`
            SELECT * FROM students_thesis_examiners
            ${where_clauses.length > 0 ? `WHERE ` : ''}
            ${where_clauses.join(' AND ')}
            ORDER BY examiner_creation_timestamp;
        `).then(db_res => {
            res.send(db_res.rows.map(row => ({
                id: row.examiner_id,
                label: `${row.examiner_name} (${row.examiner_designation ? row.examiner_designation + ' @ ' : ''}${row.examiner_university || ''})`
            })))
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.get('/autocomplete/areasOfInterest',
    (req, res) => {
        db.query(`
            SELECT * FROM teachers WHERE jsonb_array_length(areas_of_interest) > 0;
        `).then(db_res => {
            res.send(db_res.rows.reduce((arr, row) => ([...arr, ...row.areas_of_interest.filter(o => !arr.includes(o))]), []))
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

module.exports = router