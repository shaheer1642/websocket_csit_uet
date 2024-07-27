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

router.get('/semesters',
    (req, res, next) => validateData([
        query('semester_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        var where_clauses = []
        if (data.semester_id) where_clauses.push(`S.semester_id = '${data.semester_id}'`)
        if (data.student_batch_id) where_clauses.push(`S.semester_id IN (SELECT SMC.semester_id FROM students_courses SC JOIN semesters_courses SMC ON SC.sem_course_id = SMC.sem_course_id WHERE SC.student_batch_id = '${data.student_batch_id}')`)

        db.query(`
            SELECT S.*,(SELECT count(course_id) AS offered_courses FROM semesters_courses SC WHERE SC.semester_id = S.semester_id) FROM semesters S
            ${where_clauses.length > 0 ? 'WHERE' : ''}
            ${where_clauses.join(' AND ')}
            ORDER BY S.semester_start_timestamp DESC;
        `).then(db_res => {
            res.send(db_res.rows)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/semesters',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        body('semester_coordinator_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('semester_year').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('semester_season').isString().isIn(['spring', 'fall']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('semester_start_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('semester_end_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.body }

        db.query(`
            INSERT INTO semesters (semester_year, semester_season, semester_coordinator_id, semester_start_timestamp, semester_end_timestamp) 
            VALUES (
                ${data.semester_year},
                '${data.semester_season}',
                ${data.semester_coordinator_id ? `'${data.semester_coordinator_id}'` : 'NULL'},
                ${data.semester_start_timestamp},
                ${data.semester_end_timestamp}
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

router.post('/semesters/:semester_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('semester_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('semester_coordinator_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('semester_year').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('semester_season').isString().isIn(['spring', 'fall']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('semester_start_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('semester_end_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        var update_clauses = []
        if (data.semester_year) update_clauses.push(`semester_year = ${data.semester_year}`)
        if (data.semester_season) update_clauses.push(`semester_season = '${data.semester_season}'`)
        if (data.semester_coordinator_id != undefined) update_clauses.push(`semester_coordinator_id = ${data.semester_coordinator_id ? `'${data.semester_coordinator_id}'` : 'NULL'}`)
        if (data.semester_start_timestamp) update_clauses.push(`semester_start_timestamp = ${data.semester_start_timestamp}`)
        if (data.semester_end_timestamp) update_clauses.push(`semester_end_timestamp = ${data.semester_end_timestamp}`)
        if (update_clauses.length == 0) return res.status(400).send(`No valid parameters found in requested data.`)

        db.query(`
            UPDATE semesters SET
            ${update_clauses.join(',')}
            WHERE semester_id = '${data.semester_id}';
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

router.delete('/semesters/:semester_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('semester_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.params

        db.query(`
            DELETE FROM semesters WHERE semester_id='${data.semester_id}';
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