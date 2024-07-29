const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData, isBase64 } = require('../modules/validator');
const { body, param, check } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { validateApplicationTemplateDetailStructure } = require('../modules/validations');
const { uploadFile } = require('../modules/aws/aws');

router.get('/documents',
    (req, res) => {
        db.query(`SELECT * FROM documents ORDER BY document_creation_timestamp DESC`)
            .then(db_res => {
                res.send(db_res.rows)
            }).catch(err => {
                console.error(err)
                return res.status(500).send(err.message || err.detail || JSON.stringify(err))
            })
    }
)

router.post('/documents',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga', 'dpgs']),
    (req, res, next) => validateData([
        body('document').custom(isBase64).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('document_name').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.body }

        uploadFile(data.document_name, data.document).then((fileUrl) => {
            console.log('fileUrl', fileUrl)
            db.query(`
                INSERT INTO documents (document_name, document_url) 
                VALUES (
                    '${data.document_name}',
                    '${fileUrl}'
                )
                returning *;
            `).then(db_res => {
                if (db_res.rowCount == 1) res.send(db_res.rows[0])
                else res.status(500).send('unexpected DB response')
            }).catch(err => {
                console.error(err)
                res.status(500).send(err.detail || err.message || JSON.stringify(err))
            })
        }).catch((err) => {
            console.error(err)
            res.status(500).send(`error uploading file: ${JSON.stringify(err)}`)
        })
    }
)

router.delete('/documents/:document_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga', 'dpgs']),
    (req, res, next) => validateData([
        param('document_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const documentId = req.params.document_id;

        db.query(`
            DELETE FROM documents WHERE document_id = '${documentId}'
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