const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData } = require('../modules/validator');
const { body, param, check } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { validateApplicationTemplateDetailStructure } = require('../modules/validations');


// class ApplicationsTemplates {
//     name = 'Applications Templates';
//     description = 'Endpoints for creating/fetching applications templates'
//     data_types = {
//         template_id: new DataTypes(true, ['applicationsTemplates/update', 'applicationsTemplates/delete'], ['applicationsTemplates/fetch']).uuid,
//         application_title: new DataTypes(true, ['applicationsTemplates/create'], ['applicationsTemplates/update']).string,
//         detail_structure: new DataTypes(true, ['applicationsTemplates/create'], ['applicationsTemplates/update']).array,
//         degree_type: new DataTypes(true, [], ['applicationsTemplates/create', 'applicationsTemplates/update']).string,
//         submit_to: new DataTypes(true, [], ['applicationsTemplates/create', 'applicationsTemplates/update']).uuid,
//         visibility: new DataTypes(true, ['applicationsTemplates/create'], ['applicationsTemplates/update']).array,
//         restrict_visibility: new DataTypes(true, [], ['applicationsTemplates/fetch']).boolean,
//     }
// }

router.get('/applicationsTemplates',
    passport.authenticate('jwt'),
    (req, res) => {

        const data = { ...req.user, ...req.query }

        var where_clauses = []
        if (data.template_id) where_clauses.push(`template_id = '${data.template_id}'`)
        if (data.user_id && (data.restrict_visibility == undefined || data.restrict_visibility == true)) where_clauses.push(`visibility @> to_jsonb((SELECT user_type FROM users WHERE user_id = '${data.user_id}')::text)`)
        console.log(`
            SELECT * FROM students s JOIN students_batch sb on sb.student_id = s.student_id JOIN batches b on b.batch_id = sb.batch_id WHERE s.student_id = '${data.user_id}';
            SELECT * from applications_templates
            ${where_clauses.length > 0 ? 'WHERE' : ''}
            ${where_clauses.join(' AND ')}
            ORDER BY application_title;
        `)
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
            return res.send(templates)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.post('/applications',
    passport.authenticate('jwt'),
    (req, res, next) => validateData([
        body('application_title').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('submitted_to').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('detail_structure').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.user, ...req.body }

        const detailStructureValidator = validateApplicationTemplateDetailStructure(data.detail_structure, { field_value_not_empty: true })
        if (!detailStructureValidator.valid) return res.sendStatus(400)

        db.query(`
            INSERT INTO applications (
                application_title,
                submitted_by,
                submitted_to,
                detail_structure
            ) VALUES (
                '${data.application_title}',
                '${data.user_id}',
                '${data.submitted_to}',
                '${JSON.stringify(data.detail_structure)}'
            )`
        ).then(db_res => {
            if (db_res.rowCount == 1) return res.send('added record to db');
            else return res.send('database could not add record');
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.patch('/applications/:application_id/forward',
    passport.authenticate('jwt'), hasRole.bind(['admin, pga, teacher']),
    (req, res, next) => validateData([
        param('application_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('forward_to').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('remarks').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`
            SELECT * FROM applications WHERE application_id = '${data.application_id}';
        `).then(db_res => {
            if (db_res.rowCount == 0) return res.sendStatus(400);

            const application = db_res.rows[0]

            const prev_forwarder = application.forwarded_to.pop()
            if (prev_forwarder) {
                if (prev_forwarder.receiver_id == data.user_id && prev_forwarder.status == 'under_review') {
                    prev_forwarder.status = 'approved'
                    prev_forwarder.completion_timestamp = new Date().getTime()
                    application.forwarded_to.push(prev_forwarder)
                } else {
                    if (application.submitted_to != data.user_id) {
                        return res.sendStatus(500);
                    }
                    application.forwarded_to.push(prev_forwarder)
                }
            } else {
                if (application.submitted_to != data.user_id) {
                    return res.sendStatus(500);
                }
            }

            application.forwarded_to.push({
                sender_id: data.user_id,
                receiver_id: data.forward_to,
                sender_remarks: data.remarks,
                status: 'under_review',
                forward_timestamp: new Date().getTime(),
            })

            db.query(`
                UPDATE applications SET
                forwarded_to = '${JSON.stringify(application.forwarded_to)}'
                WHERE application_id = '${data.application_id}';
            `).then(db_res => {
                if (db_res.rowCount == 1) res.send("Updated successfully")
                else if (db_res.rowCount == 0) res.sendStatus(404)
                else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
            }).catch(err => {
                console.error(err)
                res.status(500).send(err.message || err.detail || JSON.stringify(err));
            })
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/applications/:application_id/updateStatus',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga', 'teacher']),
    (req, res, next) => validateData([
        param('application_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('remarks').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('status').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`
            SELECT * FROM applications WHERE application_id = '${data.application_id}';
        `).then(db_res => {
            if (db_res.rowCount == 0) return res.sendStatus(400);

            const application = db_res.rows[0]

            console.log(data.application_id, application.submitted_to, data.user_id);
            if (application.submitted_to == data.user_id) {
                db.query(`
                    UPDATE applications SET
                    status = '${data.status}',
                    remarks = '${data.remarks}',
                    application_completion_timestamp = ${new Date().getTime()}
                    WHERE application_id = '${data.application_id}';
                `).then(db_res => {
                    if (db_res.rowCount == 1) res.send("Updated successfully")
                    else if (db_res.rowCount == 0) res.sendStatus(404)
                    else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
                }).catch(err => {
                    console.error(err)
                    res.status(500).send(err.message || err.detail || JSON.stringify(err));
                })
            } else {
                const prev_forwarder = application.forwarded_to.pop()
                console.log(prev_forwarder)
                if (prev_forwarder) {
                    if (prev_forwarder.receiver_id == data.user_id && prev_forwarder.status == 'under_review') {
                        prev_forwarder.status = data.status
                        prev_forwarder.receiver_remarks = data.remarks
                        prev_forwarder.completion_timestamp = new Date().getTime()
                        application.forwarded_to.push(prev_forwarder)
                    } else {
                        console.error('error 1')
                        return res.sendStatus(500);
                    }
                } else {
                    console.error('error 2')
                    return res.sendStatus(500);
                }

                db.query(`
                    UPDATE applications SET
                    forwarded_to = '${JSON.stringify(application.forwarded_to)}'
                    WHERE application_id = '${data.application_id}';
                `).then(db_res => {
                    if (db_res.rowCount == 1) res.send("Updated successfully")
                    else if (db_res.rowCount == 0) res.sendStatus(404)
                    else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
                }).catch(err => {
                    console.error(err)
                    res.status(500).send(err.message || err.detail || JSON.stringify(err));
                })
            }
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

module.exports = router