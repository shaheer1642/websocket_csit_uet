const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData } = require('../modules/validator');
const { body, param, query } = require('express-validator')
const { hasRole } = require('../modules/auth')
const passport = require('passport');

router.get('/studentsThesisExaminers',
    (req, res, next) => validateData([
        query('examiner_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('examiner_type').isString().isIn(['internal_examiner', 'external_examiner', 'foreign_examiner']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        var where_clauses = []
        if (data.examiner_id) where_clauses.push(`STE.examiner_id = '${data.examiner_id}'`)
        if (data.examiner_type) where_clauses.push(`STE.examiner_type = '${data.examiner_type}'`)

        db.query(`
            SELECT * FROM students_thesis_examiners STE
            ${where_clauses.length > 0 ? 'WHERE' : ''}
            ${where_clauses.join(' AND ')}
            ORDER BY STE.examiner_creation_timestamp DESC;
        `).then(db_res => {
            return res.send(db_res.rows)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/studentsThesisExaminers',
    passport.authenticate('jwt'), hasRole.bind(this, ['pga']),
    (req, res, next) => validateData([
        body('examiner_name').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('examiner_type').isString().isIn(['internal_examiner', 'external_examiner', 'foreign_examiner']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('examiner_university').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('examiner_designation').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.body }

        db.query(`
            INSERT INTO students_thesis_examiners (examiner_name, examiner_university, examiner_designation, examiner_type)
            VALUES (
                '${data.examiner_name}',
                ${data.examiner_university ? `'${data.examiner_university}'` : 'NULL'},
                ${data.examiner_designation ? `'${data.examiner_designation}'` : 'NULL'},
                '${data.examiner_type}'
            );
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Created successfully")
            else res.status(500).send(`Unexpected DB response. Created ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/studentsThesisExaminers/:examiner_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['pga']),
    (req, res, next) => validateData([
        param('examiner_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('examiner_university').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('examiner_designation').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        var update_clauses = []
        if (data.examiner_designation) update_clauses.push(`examiner_designation = '${data.examiner_designation}'`)
        if (data.examiner_university) update_clauses.push(`examiner_university = '${data.examiner_university}'`)
        if (update_clauses.length == 0) return res.status(400).send(`No valid parameters found in requested data.`)

        db.query(`
            UPDATE students_thesis_examiners SET
            ${update_clauses.join(',')}
            WHERE examiner_id = '${data.examiner_id}';
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

router.delete('/studentsThesisExaminers/:examiner_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['pga']),
    (req, res, next) => validateData([
        param('examiner_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.params

        db.query(`
            DELETE FROM students_thesis_examiners WHERE examiner_id='${data.examiner_id}';
        `).then(db_res => {
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