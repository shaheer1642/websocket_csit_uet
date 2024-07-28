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

router.get('/batches',
    (req, res, next) => validateData([
        query('batch_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        db.query(`
            SELECT 
                B.*,
                D.*,
                (SELECT count(student_id) FROM students_batch SB WHERE SB.batch_id = B.batch_id) AS registered_students
            FROM batches B
            JOIN departments D ON D.department_id = B.department_id
            ${data.batch_id ? ` WHERE B.batch_id = '${data.batch_id}'` : ''}
            ORDER BY B.batch_creation_timestamp DESC
        `).then(db_res => {
            res.send(db_res.rows)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/batches',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        body('batch_advisor_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('batch_no').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('batch_stream').isString().isIn(['computer_science', 'data_science', 'cyber_security']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('enrollment_year').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('enrollment_season').isString().isIn(['spring', 'fall']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('degree_type').isString().isIn(['ms', 'phd']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('batch_expiration_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.body }

        db.query(`
            INSERT INTO batches (
                batch_no,
                batch_stream,
                enrollment_year,
                enrollment_season,
                degree_type,
                batch_advisor_id,
                batch_expiration_timestamp
            ) VALUES (
                ${data.batch_no},
                '${data.batch_stream}',
                ${data.enrollment_year},
                '${data.enrollment_season}',
                '${data.degree_type}',
                ${data.batch_advisor_id ? `,'${data.batch_advisor_id}'` : 'NULL'},
                ${data.batch_expiration_timestamp}
            )
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Created successfully")
            else res.status(500).send(`Unexpected DB response. Created ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/batches/:batch_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('batch_advisor_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('batch_no').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('batch_stream').isString().isIn(['computer_science', 'data_science', 'cyber_security']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('enrollment_year').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('enrollment_season').isString().isIn(['spring', 'fall']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('degree_type').isString().isIn(['ms', 'phd']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('batch_expiration_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        var update_clauses = []
        if (data.batch_no) update_clauses.push(`batch_no = ${data.batch_no}`)
        if (data.batch_stream) update_clauses.push(`batch_stream = '${data.batch_stream}'`)
        if (data.enrollment_year) update_clauses.push(`enrollment_year = ${data.enrollment_year}`)
        if (data.enrollment_season) update_clauses.push(`enrollment_season = '${data.enrollment_season}'`)
        if (data.degree_type) update_clauses.push(`degree_type = '${data.degree_type}'`)
        if (data.batch_expiration_timestamp) update_clauses.push(`batch_expiration_timestamp = ${data.batch_expiration_timestamp}`)
        if (data.batch_advisor_id != undefined) update_clauses.push(`batch_advisor_id = ${data.batch_advisor_id ? `'${data.batch_advisor_id}'` : 'NULL'}`)
        if (update_clauses.length == 0) return res.status(400).send(`No valid parameters found in requested data.`)

        db.query(`
            UPDATE batches SET
            ${update_clauses.join(',')}
            WHERE batch_id = '${data.batch_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.delete('/batches/:batch_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.params

        db.query(`
            WITH query_one AS ( 
                DELETE FROM users WHERE user_id IN (
                    SELECT user_id from users
                    JOIN students_batch ON students_batch.student_id = users.user_id
                    WHERE students_batch.batch_id = '${data.batch_id}'
                    AND users.user_id NOT IN (
	                    SELECT user_id from users
	                    JOIN students_batch ON students_batch.student_id = users.user_id
	                    where students_batch.batch_id != '${data.batch_id}'
                    )
                )
            )
            DELETE FROM batches WHERE batch_id = '${data.batch_id}';
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



/**
 * @swagger
 * /courses:
 *   post:
 *     summary: Create new course
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               course_id:
 *                 type: string
 *               course_name:
 *                 type: string
 *               course_description:
 *                 type: string
 *               course_type:
 *                 type: string
 *               credit_hours:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Added successfully
 */