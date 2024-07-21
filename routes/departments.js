const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData, isBase64 } = require('../modules/validator');
const { body, param, check, query } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { validateApplicationTemplateDetailStructure } = require('../modules/validations');
const { uploadFile } = require('../modules/aws/aws');

// class Departments {
//     name = 'Departments';
//     description = 'Endpoints for creating student batches'
//     data_types = {
//         serial: new DataTypes(true).autonumber,
//         department_id: new DataTypes(true, ['departments/updateChairman'], ['departments/fetch'], false, 'CS&IT').string,
//         department_name: new DataTypes(true, [], [], false, 'Computer Science & Information Technology').string,
//         chairman_id: new DataTypes(true, ['departments/updateChairman'], []).uuid,
//     }
// }

router.get('/departments',
    (req, res, next) => validateData([
        query('department_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        db.query(`
            SELECT * FROM departments
            ${data.department_id ? ` WHERE department_id = '${data.department_id}'` : ''}
            ORDER BY serial ASC;
        `).then(db_res => {
            res.send(db_res.rowCount == 1 ? db_res.rows[0] : db_res.rows)
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/departments/:department_id/updateChairman',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga']),
    (req, res, next) => validateData([
        param('department_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('chairman_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`
            UPDATE departments SET
            chairman_id = ${data.chairman_id ? `'${data.chairman_id}'` : 'NULL'}
            WHERE department_id = '${data.department_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send("Updated successfully")
            else if (db_res.rowCount == 0) res.sendStatus(404)
            else res.status(500).send(`Unexpected DB response. Deleted ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            return res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

module.exports = router