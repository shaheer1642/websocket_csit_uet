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

router.get('/courses',
    (req, res, next) => validateData([
        query('course_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('course_department_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        var where_clauses = []
        if (data.course_id) where_clauses.push(`course_id = '${data.course_id}'`)
        if (data.course_department_id) where_clauses.push(`course_department_id = '${data.course_department_id}'`)

        db.query(`
            SELECT * FROM courses
            JOIN departments ON departments.department_id = courses.course_department_id
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

router.post('/courses',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        body('course_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('course_name').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('course_description').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('course_type').isString().isIn(['core', 'elective']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('credit_hours').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.user, ...req.body }

        db.query(`
            INSERT INTO courses (course_id,course_name,course_description,course_department_id, course_type, credit_hours) 
            VALUES (
                '${data.course_id.toUpperCase()}',
                '${data.course_name}',
                ${data.course_description ? `'${escapeDBCharacters(data.course_description)}'` : 'NULL'},
                '${data.user_department_id}',
                '${data.course_type}',
                ${data.credit_hours}
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

router.post('/courses/:course_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('course_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('course_name').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('course_description').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('course_type').isString().isIn(['core', 'elective']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('credit_hours').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        var update_clauses = []
        if (data.course_name) update_clauses.push(`course_name = '${data.course_name}'`)
        if (data.course_description) update_clauses.push(`course_description = '${escapeDBCharacters(data.course_description)}'`)
        if (data.course_type) update_clauses.push(`course_type = '${data.course_type}'`)
        if (data.credit_hours) update_clauses.push(`credit_hours = ${data.credit_hours}`)
        if (update_clauses.length == 0) return res.sendStatus(400);

        db.query(`
            UPDATE courses SET
            ${update_clauses.join(',')}
            WHERE course_id = '${data.course_id}';
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

router.delete('/courses/:course_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('course_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.params

        db.query(`
            DELETE FROM courses WHERE course_id='${data.course_id}';
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