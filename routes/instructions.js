const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData } = require('../modules/validator');
const { body, param, query } = require('express-validator')
const { hasRole } = require('../modules/auth')
const passport = require('passport');


router.get('/instructions',
    (req, res, next) => validateData([
        query('instruction_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        var where_clauses = []
        if (data.instruction_id) where_clauses.push(`instruction_id = ${data.instruction_id}`)

        db.query(`
            SELECT * from instructions
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

router.post('/instructions/:instruction_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('instruction_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('instruction_detail_key').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('instruction').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        db.query(`
            UPDATE instructions SET
            detail = jsonb_set(detail, '{${data.instruction_detail_key}}', '"${escapeDBJSONCharacters(data.instruction)}"', true)
            WHERE instruction_id = ${data.instruction_id};
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

module.exports = router