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

router.get('/events',
    (req, res) => {
        db.query(`
            SELECT * FROM events ORDER BY event_creation_timestamp DESC
        `).then(db_res => {
            res.send(db_res.rows)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/events',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        body('title').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('body').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('event_expiry_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.body }

        db.query(`
            INSERT INTO events (
                title,
                body,
                event_expiry_timestamp
            ) VALUES (
                '${data.title}',
                '${data.body}',
                ${data.event_expiry_timestamp ? `${data.event_expiry_timestamp}` : null}
            )
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Added successfully")
            else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/events/:event_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('event_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('title').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('body').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('event_expiry_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        var update_clauses = []
        if (data.title) update_clauses.push(`title = '${data.title}'`)
        if (data.body) update_clauses.push(`body = '${data.body}'`)
        if (data.event_expiry_timestamp) update_clauses.push(`event_expiry_timestamp = ${data.event_expiry_timestamp}`)
        if (update_clauses.length == 0) return res.status(400).send(`No valid parameters found in requested data.`)

        db.query(`
            UPDATE events SET
            ${update_clauses.join(',')}
            WHERE event_id = '${data.event_id}'
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

router.delete('/events/:event_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('event_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.params

        db.query(`DELETE FROM events WHERE event_id = '${data.event_id}'`)
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