const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData, isBase64 } = require('../modules/validator');
const { body, param, check, query } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { uploadFile } = require('../modules/aws/aws');
const { escapeDBCharacters, formatCNIC, generateRandom1000To9999 } = require('../modules/functions');
const { hashPassword } = require('../modules/hashing');

// class Teachers {
//     name = 'Teachers';
//     description = 'Endpoints for creating teacher'
//     data_types = {
//         teacher_id: new DataTypes(true, ['teachers/update', 'teachers/delete'], ['teachers/fetch']).uuid,
//         cnic: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, '1730155555555').string,
//         teacher_name: new DataTypes(true, ['teachers/create'], ['teachers/update']).string,
//         teacher_gender: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, 'male').string,
//         digital_signature: new DataTypes(true, [], ['teachers/update'], false, 'image-buffer').any,
//         areas_of_interest: new DataTypes(true, [], ['teachers/update']).array,
//         teacher_department_id: new DataTypes(true, ['teachers/create'], ['teachers/update']).string,
//         qualification: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, 'male').string,
//         designation: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, 'male').string,
//         teacher_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
//         user_id: new DataTypes(true).uuid,
//         username: new DataTypes(true).string,
//         password: new DataTypes(true).string,
//         user_type: new DataTypes(true).string,
//         user_email: new DataTypes(true, [], ['teachers/update', 'teachers/create']).email,
//     }
// }

router.get('/teachers',
    (req, res, next) => validateData([
        query('teacher_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        var where_clauses = []
        if (data.teacher_id) where_clauses.push(`T.teacher_id = '${data.teacher_id}'`)

        db.query(`
            SELECT 
                T.*, 
                U.*,
                (SELECT count(SC.sem_course_id) FROM semesters_courses SC WHERE SC.teacher_id = T.teacher_id) AS courses_taught,
                (SELECT count(ST.student_batch_id) FROM students_thesis ST JOIN students_batch SB ON SB.student_batch_id = ST.student_batch_id JOIN batches B ON B.batch_id = SB.batch_id WHERE ST.supervisor_id = T.teacher_id AND ST.grade NOT IN ('N','I') AND B.degree_type = 'ms') AS ms_students_supervised,
                (SELECT count(ST.student_batch_id) FROM students_thesis ST JOIN students_batch SB ON SB.student_batch_id = ST.student_batch_id JOIN batches B ON B.batch_id = SB.batch_id WHERE ST.supervisor_id = T.teacher_id AND ST.grade NOT IN ('N','I') AND B.degree_type = 'phd') AS phd_students_supervised,
                (SELECT count(ST.student_batch_id) FROM students_thesis ST JOIN students_batch SB ON SB.student_batch_id = ST.student_batch_id JOIN batches B ON B.batch_id = SB.batch_id WHERE ST.supervisor_id = T.teacher_id AND ST.grade IN ('N','I') AND B.degree_type = 'ms') AS ms_students_under_supervision,
                (SELECT count(ST.student_batch_id) FROM students_thesis ST JOIN students_batch SB ON SB.student_batch_id = ST.student_batch_id JOIN batches B ON B.batch_id = SB.batch_id WHERE ST.supervisor_id = T.teacher_id AND ST.grade IN ('N','I') AND B.degree_type = 'phd') AS phd_students_under_supervision
            FROM teachers T
            JOIN users U ON U.user_id = T.teacher_id
            ${where_clauses.length > 0 ? 'WHERE' : ''}
            ${where_clauses.join(' AND ')}
            ORDER BY T.teacher_name ASC;
        `).then(db_res => {
            res.send(db_res.rows)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/teachers',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        body('teacher_name').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('teacher_department_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('cnic').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('reg_no').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('teacher_gender').isString().isIn(['male', 'female']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('qualification').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('designation').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('user_email').isEmail().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.body }

        if (!data.cnic && !data.reg_no) return res.status(400).send('Both CNIC and Reg No cannot be empty');
        data.cnic = data.cnic?.toString().toLowerCase()
        data.reg_no = data.reg_no?.toString().toLowerCase()
        if (data.cnic) {
            data.cnic = formatCNIC(data.cnic)
            if (!data.cnic) return res.status(400).send('CNIC must be exactly 13 characters long')
        }
        const default_password = generateRandom1000To9999()
        db.query(`
            WITH query_one AS ( 
                INSERT INTO users (username, password, default_password, user_type, user_email) 
                VALUES (
                    '${data.reg_no || data.cnic}',
                    '${hashPassword(default_password)}',
                    '${default_password}',
                    'teacher',
                    ${data.user_email ? `'${data.user_email}'` : null}
                ) 
                RETURNING user_id 
            )
            INSERT INTO teachers (teacher_id, cnic, reg_no, teacher_name, teacher_gender, qualification, designation, teacher_department_id) 
            VALUES (
                ( select user_id from query_one ),
                ${data.cnic ? `'${data.cnic}'` : null},
                ${data.reg_no ? `'${data.reg_no}'` : null},
                '${data.teacher_name}',
                ${data.teacher_gender ? `'${data.teacher_gender}'` : null},
                ${data.qualification ? `'${escapeDBCharacters(data.qualification)}'` : null},
                ${data.designation ? `'${data.designation}'` : null},
                '${data.teacher_department_id}'
            );
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Added successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Added ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/teachers/:teacher_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('teacher_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('cnic').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('reg_no').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('teacher_name').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('teacher_gender').isString().isIn(['male', 'female']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('digital_signature').custom(isBase64).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('areas_of_interest').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('teacher_department_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('qualification').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('designation').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('user_email').isEmail().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        if (data.cnic) {
            data.cnic = formatCNIC(data.cnic)
            if (!data.cnic) return res.status(400).send('CNIC must be exactly 13 characters long')
        }

        var update_clauses = []
        if (data.teacher_name) update_clauses.push(`teacher_name = '${data.teacher_name}'`)
        if (data.teacher_gender) update_clauses.push(`teacher_gender = '${data.teacher_gender}'`)
        if (data.qualification) update_clauses.push(`qualification = '${escapeDBCharacters(data.qualification)}'`)
        if (data.designation) update_clauses.push(`designation = '${data.designation}'`)
        if (data.cnic) update_clauses.push(`cnic = '${data.cnic}'`)
        if (data.reg_no) update_clauses.push(`reg_no = '${data.reg_no}'`)
        if (data.areas_of_interest) update_clauses.push(`areas_of_interest = '${JSON.stringify(data.areas_of_interest)}'`)
        if (data.teacher_department_id) update_clauses.push(`teacher_department_id = '${data.teacher_department_id}'`)
        if (data.digital_signature) {
            console.log('digital_signature detected')
            const fileUrl = await uploadFile('digital_signature', data.digital_signature).catch(console.error)
            console.log('fileUrl', fileUrl)
            if (fileUrl) update_clauses.push(`digital_signature = '${fileUrl}'`)
        }
        if (update_clauses.length == 0) return res.status(400).send('No valid parameters found in requested data.')

        db.query(
            data.cnic || data.reg_no ?
                `WITH query_one AS ( 
                UPDATE teachers SET
                ${update_clauses.join(',')}
                WHERE teacher_id = '${data.teacher_id}'
                RETURNING cnic, reg_no
            )
            UPDATE users SET 
            username = ( select COALESCE(cnic, reg_no) from query_one ) 
            ${data.user_email ? `,user_email = '${data.user_email}'` : ''}
            WHERE user_id = '${data.teacher_id}';`
                :
                `UPDATE teachers SET
            ${update_clauses.join(',')}
            WHERE teacher_id = '${data.teacher_id}';`
        ).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.delete('/teachers/:teacher_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('teacher_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.params

        db.query(`
            DELETE FROM users WHERE teacher_id='${data.teacher_id}';
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