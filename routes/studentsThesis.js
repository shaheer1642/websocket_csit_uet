const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData, isBase64 } = require('../modules/validator');
const { body, param, check, query } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { validateApplicationTemplateDetailStructure } = require('../modules/validations');
const { uploadFile } = require('../modules/aws/aws');
const { escapeDBCharacters, getDepartmentIdFromCourseId, dynamicSortDesc } = require('../modules/functions');


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

router.get('/studentsThesis',
    passport.authenticate('jwt'),
    (req, res, next) => validateData([
        query('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('thesis_type').isString().isIn(['research', 'project']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('grade').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        query('supervisor_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    (req, res) => {
        const data = req.query

        var where_clauses = []
        if (data.student_batch_id) where_clauses.push(`ST.student_batch_id = '${data.student_batch_id}'`)
        if (data.grade) where_clauses.push(`ST.grade = '${data.grade}'`)
        if (data.thesis_type) where_clauses.push(`ST.thesis_type = '${data.thesis_type}'`)
        if (data.supervisor_id) where_clauses.push(`ST.supervisor_id = '${data.supervisor_id}'`)

        db.query(`
            ${['students_thesis_ms_research', 'students_thesis_ms_project', 'students_thesis_phd_research'].map(table => {
            return `
                    SELECT * FROM ${table} ST
                    JOIN students_batch SB ON SB.student_batch_id = ST.student_batch_id
                    JOIN students S ON S.student_id = SB.student_id
                    JOIN batches B ON B.batch_id = SB.batch_id
                    ${where_clauses.length > 0 ? 'WHERE' : ''}
                    ${where_clauses.join(' AND ')};
                `
        }).join('\n')}
        `).then(db_res => {
            res.send(db_res.reduce((arr, obj) => arr.concat(obj.rows), []).sort(dynamicSortDesc('batch_no')))
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/studentsThesis',
    passport.authenticate('jwt'), hasRole.bind(this, ['pga']),
    (req, res, next) => validateData([
        body('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('thesis_type').isString().isIn(['research', 'project']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('thesis_title').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('supervisor_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('co_supervisor_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res) => {
        const data = { ...req.body }

        fetchStudentDegreeAndThesisTypes(data.student_batch_id).then(studentData => {
            if (studentData.degree_type == 'phd' && data.thesis_type == 'project') return res.status(400).send(`PhD project cannot be created`)

            db.query(`
                INSERT INTO students_thesis_${studentData.degree_type}_${data.thesis_type} 
                (student_batch_id, thesis_type, thesis_title, supervisor_id, co_supervisor_id)
                VALUES (
                    '${data.student_batch_id}',
                    '${data.thesis_type}',
                    '${escapeDBCharacters(data.thesis_title)}',
                    ${data.supervisor_id ? `'${data.supervisor_id}'` : 'NULL'},
                    ${data.co_supervisor_id ? `'${data.co_supervisor_id}'` : 'NULL'}
                );
            `).then(db_res => {
                if (db_res.rowCount == 1) res.send('Added record to db')
                else res.status(500).send('Unexpected DB response')
            }).catch(err => {
                console.error(err)
                res.status(500).send(err.detail || err.message || JSON.stringify(err))
            })
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.post('/studentsThesis/:student_batch_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['pga']),
    (req, res, next) => validateData([
        param('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),

        body('thesis_type').isString().isIn(['research', 'project']).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('thesis_title').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),

        body('supervisor_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('co_supervisor_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('internal_examiner').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('external_examiner').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('examiner_within_department').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('examiner_outside_department').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('examiner_outside_university').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),
        body('examiner_from_industry').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional({ values: 'null' }),

        body('foreign_thesis_evaluator_1').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('foreign_thesis_evaluator_2').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),

        body('boasar_notification_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('qe_notification_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('fe_notification_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('rec_notification_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('rec_i_meeting_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('rec_ii_meeting_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('rec_iii_meeting_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('proposal_submission_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('committee_notification_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('defense_day_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),

        body('phase_0_documents').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('phase_1_documents').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('phase_2_documents').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('phase_3_documents').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('phase_4_documents').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('phase_5_documents').isArray().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),

    ], req, res, next),
    async (req, res) => {
        const data = { ...req.params, ...req.body }

        fetchStudentDegreeAndThesisTypes(data.student_batch_id).then(async studentData => {
            const child_table = `students_thesis_${studentData.degree_type}_${studentData.thesis_type}`

            var update_clauses = []

            if (data.thesis_type) update_clauses.push(`thesis_type = '${data.thesis_type}'`)
            if (data.thesis_title) update_clauses.push(`thesis_title = '${escapeDBCharacters(data.thesis_title)}'`)

            if (data.supervisor_id !== undefined) update_clauses.push(`supervisor_id = ${data.supervisor_id ? `'${data.supervisor_id}'` : 'NULL'}`)
            if (data.co_supervisor_id !== undefined) update_clauses.push(`co_supervisor_id = ${data.co_supervisor_id ? `'${data.co_supervisor_id}'` : 'NULL'}`)
            if (data.internal_examiner !== undefined) update_clauses.push(`internal_examiner = ${data.internal_examiner ? `'${data.internal_examiner}'` : 'NULL'}`)
            if (data.external_examiner !== undefined) update_clauses.push(`external_examiner = ${data.external_examiner ? `'${data.external_examiner}'` : 'NULL'}`)
            if (data.examiner_within_department !== undefined) update_clauses.push(`examiner_within_department = ${data.examiner_within_department ? `'${data.examiner_within_department}'` : 'NULL'}`)
            if (data.examiner_outside_department !== undefined) update_clauses.push(`examiner_outside_department = ${data.examiner_outside_department ? `'${data.examiner_outside_department}'` : 'NULL'}`)
            if (data.examiner_outside_university !== undefined) update_clauses.push(`examiner_outside_university = ${data.examiner_outside_university ? `'${data.examiner_outside_university}'` : 'NULL'}`)
            if (data.examiner_from_industry !== undefined) update_clauses.push(`examiner_from_industry = ${data.examiner_from_industry ? `'${data.examiner_from_industry}'` : 'NULL'}`)
            if (data.foreign_thesis_evaluator_1 !== undefined) update_clauses.push(`foreign_thesis_evaluator_1 = ${data.foreign_thesis_evaluator_1 ? `'${data.foreign_thesis_evaluator_1}'` : 'NULL'}`)
            if (data.foreign_thesis_evaluator_2 !== undefined) update_clauses.push(`foreign_thesis_evaluator_2 = ${data.foreign_thesis_evaluator_2 ? `'${data.foreign_thesis_evaluator_2}'` : 'NULL'}`)

            if (data.boasar_notification_timestamp) update_clauses.push(`boasar_notification_timestamp = ${data.boasar_notification_timestamp}`)
            if (data.qe_notification_timestamp) update_clauses.push(`qe_notification_timestamp = ${data.qe_notification_timestamp}`)
            if (data.fe_notification_timestamp) update_clauses.push(`fe_notification_timestamp = ${data.fe_notification_timestamp}`)
            if (data.rec_notification_timestamp) update_clauses.push(`rec_notification_timestamp = ${data.rec_notification_timestamp}`)
            if (data.rec_i_meeting_timestamp) update_clauses.push(`rec_i_meeting_timestamp = ${data.rec_i_meeting_timestamp}`)
            if (data.rec_ii_meeting_timestamp) update_clauses.push(`rec_ii_meeting_timestamp = ${data.rec_ii_meeting_timestamp}`)
            if (data.rec_iii_meeting_timestamp) update_clauses.push(`rec_iii_meeting_timestamp = ${data.rec_iii_meeting_timestamp}`)
            if (data.proposal_submission_timestamp) update_clauses.push(`proposal_submission_timestamp = ${data.proposal_submission_timestamp}`)
            if (data.committee_notification_timestamp) update_clauses.push(`committee_notification_timestamp = ${data.committee_notification_timestamp}`)
            if (data.defense_day_timestamp) update_clauses.push(`defense_day_timestamp = ${data.defense_day_timestamp}`)

            if (data.phase_0_documents) {
                const document_ids = await uploadDocumentsFromArray(data.phase_0_documents, req.user.jwt_token).catch(console.error)
                if (!document_ids) return res.sendStatus(500)
                update_clauses.push(`phase_0_documents = '${JSON.stringify(document_ids)}'`)
            }
            if (data.phase_1_documents) {
                const document_ids = await uploadDocumentsFromArray(data.phase_1_documents, req.user.jwt_token).catch(console.error)
                if (!document_ids) return res.sendStatus(500)
                update_clauses.push(`phase_1_documents = '${JSON.stringify(document_ids)}'`)
            }
            if (data.phase_2_documents) {
                const document_ids = await uploadDocumentsFromArray(data.phase_2_documents, req.user.jwt_token).catch(console.error)
                if (!document_ids) return res.sendStatus(500)
                update_clauses.push(`phase_2_documents = '${JSON.stringify(document_ids)}'`)
            }
            if (data.phase_3_documents) {
                const document_ids = await uploadDocumentsFromArray(data.phase_3_documents, req.user.jwt_token).catch(console.error)
                if (!document_ids) return res.sendStatus(500)
                update_clauses.push(`phase_3_documents = '${JSON.stringify(document_ids)}'`)
            }
            if (data.phase_4_documents) {
                const document_ids = await uploadDocumentsFromArray(data.phase_4_documents, req.user.jwt_token).catch(console.error)
                if (!document_ids) return res.sendStatus(500)
                update_clauses.push(`phase_4_documents = '${JSON.stringify(document_ids)}'`)
            }
            if (data.phase_5_documents) {
                const document_ids = await uploadDocumentsFromArray(data.phase_5_documents, req.user.jwt_token).catch(console.error)
                if (!document_ids) return res.sendStatus(500)
                update_clauses.push(`phase_5_documents = '${JSON.stringify(document_ids)}'`)
            }

            if (update_clauses.length == 0) return res.status(400).send(`No valid parameters found in requested data.`)

            db.query(`
                UPDATE ${child_table} SET
                ${update_clauses.join(',')}
                WHERE student_batch_id = '${data.student_batch_id}';
            `).then(db_res => {
                if (db_res.rowCount == 1) res.send("Updated successfully")
                else if (db_res.rowCount == 0) res.sendStatus(404)
                else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
            }).catch(err => {
                console.error(err)
                res.status(500).send(err.detail || err.message || JSON.stringify(err))
            })
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.patch('/studentsThesis/:student_batch_id/updateGrade',
    passport.authenticate('jwt'), hasRole.bind(this, ['pga']),
    (req, res, next) => validateData([
        param('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('grade').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('completion_timestamp').isInt().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body, ...req.params }

        db.query(`
            UPDATE students_thesis SET
            grade = '${data.grade}',
            completion_timestamp = ${data.completion_timestamp},
            grade_change_logs = grade_change_logs || '"${new Date().getTime()} ${data.user_id} ${data.grade}"'
            WHERE student_batch_id = '${data.student_batch_id}';
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

router.delete('/studentsThesis/:student_batch_id',
    passport.authenticate('jwt'), hasRole.bind(this, ['pga']),
    (req, res, next) => validateData([
        param('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.params

        db.query(`
            DELETE FROM students_thesis WHERE student_batch_id='${data.student_batch_id}';
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


function fetchStudentDegreeAndThesisTypes(student_batch_id) {
    return new Promise((resolve, reject) => {
        db.query(`
            SELECT * FROM batches WHERE batch_id = (select batch_id from students_batch SB where student_batch_id = '${student_batch_id}');
            SELECT * FROM students_thesis WHERE student_batch_id = '${student_batch_id}';
        `).then(db_res => {
            if (db_res[0].rowCount != 1) {
                return reject({
                    code: 400,
                    status: 'BAD REQUEST',
                    message: 'Invalid student_batch_id provided'
                });
            } else {
                return resolve({
                    degree_type: db_res[0].rows[0].degree_type,
                    thesis_type: db_res[1].rows[0]?.thesis_type,
                })
            }
        }).catch(err => {
            console.error(err)
            reject(err.detail || err.message || JSON.stringify(err));
        })
    })
}

async function uploadDocumentsFromArray(documents, token) {
    return new Promise((resolve, reject) => {
        const document_ids = []
        const promises = []
        documents.map(doc => {
            if (doc.document_id) return document_ids.push({ document_id: doc.document_id })

            promises.push(
                new Promise((resolve, reject) => {

                    fetch(process.env.SERVER_URL + `/api/documents`, {
                        method: 'POST',
                        headers: {
                            'Content-type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            document: doc.document,
                            document_name: doc.document_name
                        })
                    }).then(r => r.json()).then(res => {
                        document_ids.push({ document_id: res.document_id })
                        resolve(true)
                    }).catch(reject)
                    // documentsCreate({ document: doc.document, document_name: doc.document_name }, (res) => {
                    //     console.log('uploadDocumentsFromArray', res)
                    //     if (res.code == 200) {
                    //         document_ids.push({ document_id: res.data.document_id })
                    //         resolve(true)
                    //     } else {
                    //         resolve(false)
                    //     }
                    // })
                })
            )
        })
        Promise.all(promises).then(responses => {
            resolve(document_ids)
        }).catch(reject)
    })
}

module.exports = router