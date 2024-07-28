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

router.get('/applicationsTemplates',
    passport.authenticate('jwt'),
    (req, res, next) => validateData([
        query('template_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('restrict_visibility').isBoolean().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.query }

        var where_clauses = []
        if (data.template_id) where_clauses.push(`template_id = '${data.template_id}'`)
        if (data.user_id && (data.restrict_visibility == undefined || data.restrict_visibility == true)) where_clauses.push(`visibility @> to_jsonb((SELECT user_type FROM users WHERE user_id = '${data.user_id}')::text)`)

        db.query(`
            SELECT * FROM students s JOIN students_batch sb on sb.student_id = s.student_id JOIN batches b on b.batch_id = sb.batch_id WHERE s.student_id = '${data.user_id}';
            SELECT * from applications_templates
            ${where_clauses.length > 0 ? 'WHERE' : ''}
            ${where_clauses.join(' AND ')}
            ORDER BY application_title;
        `).then(db_res => {
            const user = db_res[0].rows
            var templates = db_res[1].rows
            if (user.length > 0) templates = templates.filter(template => !template.degree_type || user.some(batch => template.degree_type == batch.degree_type))
            res.send(templates)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/applicationsTemplates',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        body('application_title').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('detail_structure').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('visibility').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('degree_type').isString().isIn(['ms', 'phd']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('submit_to').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.body }

        const detailStructureValidator = validateApplicationTemplateDetailStructure(data.detail_structure)
        if (!detailStructureValidator.valid) return res.status(400).send(detailStructureValidator.message)

        db.query(`
            INSERT INTO applications_templates (
                application_title,
                detail_structure,
                visibility
                ${data.degree_type ? ',degree_type' : ''}
                ${data.submit_to ? ',submit_to' : ''}
            ) VALUES (
                '${data.application_title}',
                '${JSON.stringify(data.detail_structure)}',
                '${JSON.stringify(data.visibility)}'
                ${data.degree_type ? `,'${data.degree_type}'` : ''}
                ${data.submit_to ? `,'${data.submit_to}'` : ''}
            )
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send('Added record to db')
            else res.status(500).send('Unexpected DB error')
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/applicationsTemplates/:template_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('template_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('application_title').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('detail_structure').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('visibility').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('degree_type').isString().isIn(['ms', 'phd']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('submit_to').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        if (data.detail_structure) {
            const detailStructureValidator = validateApplicationTemplateDetailStructure(data.detail_structure)
            if (!detailStructureValidator.valid) return res.status(400).send(detailStructureValidator.message)
        }

        var update_clauses = []
        if (data.application_title) update_clauses.push(`application_title = '${data.application_title}'`)
        if (data.detail_structure) update_clauses.push(`detail_structure = '${JSON.stringify(data.detail_structure)}'`)
        if (data.visibility) update_clauses.push(`visibility = '${JSON.stringify(data.visibility)}'`)
        if (data.degree_type !== undefined) update_clauses.push(`degree_type = ${data.degree_type === null ? 'NULL' : `'${data.degree_type}'`}`)
        if (data.submit_to !== undefined) update_clauses.push(`submit_to = ${data.submit_to === null ? 'NULL' : `'${data.submit_to}'`}`)
        if (update_clauses.length == 0) return res.status(400).send(`No valid parameters found in requested data.`)

        db.query(`
            UPDATE applications_templates SET
            ${update_clauses.join(',')}
            WHERE template_id = '${data.template_id}';
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

router.delete('/applicationsTemplates/:template_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('template_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.params

        db.query(`DELETE FROM applications_templates WHERE template_id = '${data.template_id}'`)
            .then(db_res => {
                if (db_res.rowCount == 1) res.send("Deleted successfully")
                else if (db_res.rowCount == 0) res.sendStatus(404)
                else res.status(500).send(`Unexpected DB response. Deleted ${db_res.rowCount} rows`)
            }).catch(err => {
                console.error(err)
                res.status(500).send(err.detail || err.message || JSON.stringify(err))
            })
    }
)

module.exports = router