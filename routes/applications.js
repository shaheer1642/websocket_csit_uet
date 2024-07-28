const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData } = require('../modules/validator');
const { body, param, check } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { validateApplicationTemplateDetailStructure } = require('../modules/validations');

router.get('/applications',
    passport.authenticate('jwt'),
    (req, res) => {

        const data = { ...req.user, ...req.query }

        var where_clauses = []
        if (data.application_id) where_clauses.push(`application_id = '${data.application_id}'`)
        where_clauses.push(`(submitted_by = '${data.user_id}' OR submitted_to = '${data.user_id}' OR forwarded_to @> '[{"receiver_id": "${data.user_id}"}]')`)

        db.query(`
            SELECT * from applications
            ${where_clauses.length > 0 ? 'WHERE' : ''}
            ${where_clauses.join(' AND ')}
            ORDER BY application_creation_timestamp DESC;
            SELECT * FROM teachers t JOIN users u on u.user_id = t.teacher_id WHERE t.teacher_id IN (SELECT submitted_by FROM applications);
            SELECT * FROM students s JOIN users u on u.user_id = s.student_id JOIN students_batch sb on sb.student_id = s.student_id JOIN batches b on b.batch_id = sb.batch_id WHERE s.student_id IN (SELECT submitted_by FROM applications);
            SELECT * FROM users u WHERE u.user_type NOT IN ('student','teacher');
        `).then(db_res => {
            const applications = db_res[0].rows
            const users_list = []

            db_res[1].rows.concat(db_res[2].rows.concat(db_res[3].rows)).map(user => {
                users_list.push(
                    user.user_type != 'student' && user.user_type != 'teacher' ? {
                        name: user.user_type,
                        user_id: user.user_id
                    } : user.user_type == 'student' ?
                        Object.fromEntries(Object.entries(user).filter(([key]) => key == 'user_id' || key == 'student_name' || key == 'student_father_name' || key == 'student_gender' || key == 'reg_no' || key == 'batch_no' || key == 'degree_type'))
                        : user.user_type == 'teacher' ?
                            Object.fromEntries(Object.entries(user).filter(([key]) => key == 'user_id' || key == 'teacher_name' || key == 'teacher_gender' || key == 'reg_no')) : {}
                )
            })
            // console.log(users_list)
            applications.map((application, index) => {
                applications[index].applicant_detail = users_list.filter(user => user.user_id == application.submitted_by)
            })

            res.send(applications)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
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