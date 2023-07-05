const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter');
const { documentsCreate, uploadDocumentsFromArray } = require('./documents');
const { dynamicSortDesc, escapeDBCharacters } = require('../functions');

class StudentsThesis {
    name = 'Students Thesis';
    description = 'Endpoints for assigning thesis to students'
    data_types = {
        student_batch_id: new DataTypes(true,['studentsThesis/create','studentsThesis/updateGrade','studentsThesis/update','studentsThesis/delete'],['studentsThesis/fetch']).uuid,
        thesis_type: new DataTypes(true,['studentsThesis/create'],['studentsThesis/fetch','studentsThesis/update']).string,
        thesis_title: new DataTypes(true,['studentsThesis/create'],['studentsThesis/update']).string,
        grade: new DataTypes(true,['studentsThesis/updateGrade'],['studentsThesis/fetch'],false,'B').string,
        completion_timestamp: new DataTypes(true,['studentsThesis/updateGrade'],[]).unix_timestamp_milliseconds,
        undertaking_timestamp: new DataTypes(true,[],[]).unix_timestamp_milliseconds,

        supervisor_id: new DataTypes(true,[],['studentsThesis/create','studentsThesis/update']).uuid,
        co_supervisor_id: new DataTypes(true,[],['studentsThesis/create','studentsThesis/update']).uuid,
        internal_examiner: new DataTypes(true,[],['studentsThesis/update']).uuid,
        external_examiner: new DataTypes(true,[],['studentsThesis/update']).uuid,
        examiner_within_department: new DataTypes(true,[],['studentsThesis/update']).uuid,
        examiner_outside_department: new DataTypes(true,[],['studentsThesis/update']).uuid,
        examiner_outside_university: new DataTypes(true,[],['studentsThesis/update']).uuid,
        examiner_from_industry: new DataTypes(true,[],['studentsThesis/update']).uuid,
        foreign_thesis_evaluator_1: new DataTypes(true,[],['studentsThesis/update']).uuid,
        foreign_thesis_evaluator_2: new DataTypes(true,[],['studentsThesis/update']).uuid,

        boasar_notification_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        qe_notification_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        fe_notification_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        rec_notification_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        rec_i_meeting_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        rec_ii_meeting_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        rec_iii_meeting_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        proposal_submission_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        committee_notification_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        defense_day_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        
        phase_0_documents: new DataTypes(true,[],['studentsThesis/update']).array,
        phase_1_documents: new DataTypes(true,[],['studentsThesis/update']).array,
        phase_2_documents: new DataTypes(true,[],['studentsThesis/update']).array,
        phase_3_documents: new DataTypes(true,[],['studentsThesis/update']).array,
        phase_4_documents: new DataTypes(true,[],['studentsThesis/update']).array,
        phase_5_documents: new DataTypes(true,[],['studentsThesis/update']).array,
    }
}

function studentsThesisFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new StudentsThesis,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.student_batch_id) where_clauses.push(`ST.student_batch_id = '${data.student_batch_id}'`)
        if (data.grade) where_clauses.push(`ST.grade = '${data.grade}'`)
        if (data.thesis_type) where_clauses.push(`ST.thesis_type = '${data.thesis_type}'`)
        db.query(`
            ${
                ['students_thesis_ms_research','students_thesis_ms_project','students_thesis_phd_research'].map(table => {
                    return `
                        SELECT * FROM ${table} ST
                        JOIN students_batch SB ON SB.student_batch_id = ST.student_batch_id
                        JOIN students S ON S.student_id = SB.student_id
                        JOIN batches B ON B.batch_id = SB.batch_id
                        ${where_clauses.length > 0 ? 'WHERE':''}
                        ${where_clauses.join(' AND ')};
                    `
                }).join('\n')
            }
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: res.reduce((arr,obj) => arr.concat(obj.rows),[]).sort(dynamicSortDesc('batch_expiration_timestamp'))
            })
        }).catch(err => {
            console.error(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

function fetchStudentDegreeAndThesisTypes(student_batch_id) {
    return new Promise((resolve,reject) => {
        db.query(`
            SELECT * FROM batches WHERE batch_id = (select batch_id from students_batch SB where student_batch_id = '${student_batch_id}');
            SELECT * FROM students_thesis WHERE student_batch_id = '${student_batch_id}';
        `).then(res => {
            if (res[0].rowCount != 1) {
                return reject({
                    code: 400, 
                    status: 'BAD REQUEST',
                    message: 'Invalid student_batch_id provided'
                });
            } else {
                return resolve({
                    degree_type: res[0].rows[0].degree_type,
                    thesis_type: res[1].rows[0]?.thesis_type,
                })
            }
        }).catch(err => {
            console.error(err)
            reject(validations.validateDBSelectQueryError(err));
        })
    })
}

function studentsThesisCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new StudentsThesis,data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        fetchStudentDegreeAndThesisTypes(data.student_batch_id)
        .then(res => {
            if (res.degree_type == 'phd' && data.thesis_type == 'project') return callback({ code: 400, status: 'BAD REQUEST', message: `PhD project cannot be created` }); 
            db.query(`
                INSERT INTO students_thesis_${res.degree_type}_${data.thesis_type} (student_batch_id, thesis_type, thesis_title, supervisor_id, co_supervisor_id)
                VALUES (
                    '${data.student_batch_id}',
                    '${data.thesis_type}',
                    '${escapeDBCharacters(data.thesis_title)}',
                    ${data.supervisor_id ? `'${data.supervisor_id}'`:'NULL'},
                    ${data.co_supervisor_id ? `'${data.co_supervisor_id}'`:'NULL'}
                );
            `).then(res => {
                if (!callback) return
                if (res.rowCount == 1) {
                    return callback({
                        code: 200, 
                        status: 'OK',
                        message: 'added record to db'
                    });
                } else {
                    return callback({
                        code: 500, 
                        status: 'INTERNAL ERROR',
                        message: 'unexpected DB response'
                    });
                }
            }).catch(err => {
                console.error(err)
                if (callback) {
                    callback(validations.validateDBInsertQueryError(err));
                }
            })
        }).catch(err => {
            if (callback) {
                callback(err);
            }
        })
    }
}

async function studentsThesisUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new StudentsThesis,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    fetchStudentDegreeAndThesisTypes(data.student_batch_id)
    .then(async res => {
        const child_table = `students_thesis_${res.degree_type}_${res.thesis_type}`
        
        var update_clauses = []

        if (data.thesis_type) update_clauses.push(`thesis_type = '${data.thesis_type}'`)
        if (data.thesis_title) update_clauses.push(`thesis_title = '${escapeDBCharacters(data.thesis_title)}'`)
        
        if (data.supervisor_id != undefined) update_clauses.push(`supervisor_id = ${data.supervisor_id ? `'${data.supervisor_id}'` : 'NULL'}`)
        if (data.co_supervisor_id != undefined) update_clauses.push(`co_supervisor_id = ${data.co_supervisor_id ? `'${data.co_supervisor_id}'` : 'NULL'}`)
        if (data.internal_examiner != undefined) update_clauses.push(`internal_examiner = ${data.internal_examiner ? `'${data.internal_examiner}'` : 'NULL'}`)
        if (data.external_examiner != undefined) update_clauses.push(`external_examiner = ${data.external_examiner ? `'${data.external_examiner}'` : 'NULL'}`)
        if (data.examiner_within_department != undefined) update_clauses.push(`examiner_within_department = ${data.examiner_within_department ? `'${data.examiner_within_department}'` : 'NULL'}`)
        if (data.examiner_outside_department != undefined) update_clauses.push(`examiner_outside_department = ${data.examiner_outside_department ? `'${data.examiner_outside_department}'` : 'NULL'}`)
        if (data.examiner_outside_university != undefined) update_clauses.push(`examiner_outside_university = ${data.examiner_outside_university ? `'${data.examiner_outside_university}'` : 'NULL'}`)
        if (data.examiner_from_industry != undefined) update_clauses.push(`examiner_from_industry = ${data.examiner_from_industry ? `'${data.examiner_from_industry}'` : 'NULL'}`)
        if (data.foreign_thesis_evaluator_1 != undefined) update_clauses.push(`foreign_thesis_evaluator_1 = ${data.foreign_thesis_evaluator_1 ? `'${data.foreign_thesis_evaluator_1}'` : 'NULL'}`)
        if (data.foreign_thesis_evaluator_2 != undefined) update_clauses.push(`foreign_thesis_evaluator_2 = ${data.foreign_thesis_evaluator_2 ? `'${data.foreign_thesis_evaluator_2}'` : 'NULL'}`)

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
            const document_ids = await uploadDocumentsFromArray(data.phase_0_documents).catch(console.error)
            update_clauses.push(`phase_0_documents = '${JSON.stringify(document_ids)}'`)
        }
        if (data.phase_1_documents) {
            const document_ids = await uploadDocumentsFromArray(data.phase_1_documents).catch(console.error)
            update_clauses.push(`phase_1_documents = '${JSON.stringify(document_ids)}'`)
        }
        if (data.phase_2_documents) {
            const document_ids = await uploadDocumentsFromArray(data.phase_2_documents).catch(console.error)
            update_clauses.push(`phase_2_documents = '${JSON.stringify(document_ids)}'`)
        }
        if (data.phase_3_documents) {
            const document_ids = await uploadDocumentsFromArray(data.phase_3_documents).catch(console.error)
            update_clauses.push(`phase_3_documents = '${JSON.stringify(document_ids)}'`)
        }
        if (data.phase_4_documents) {
            const document_ids = await uploadDocumentsFromArray(data.phase_4_documents).catch(console.error)
            update_clauses.push(`phase_4_documents = '${JSON.stringify(document_ids)}'`)
        }
        if (data.phase_5_documents) {
            const document_ids = await uploadDocumentsFromArray(data.phase_5_documents).catch(console.error)
            update_clauses.push(`phase_5_documents = '${JSON.stringify(document_ids)}'`)
        }

        if (update_clauses.length == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `No valid parameters found in requested data.`, });
        
        db.query(`
            UPDATE ${child_table} SET
            ${update_clauses.join(',')}
            WHERE student_batch_id = '${data.student_batch_id}';
        `).then(res => {
            if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `updated ${data.student_batch_id} record in db` });
            else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.student_batch_id} does not exist` });
            else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
        }).catch(err => {
            console.error(err)
            return callback(validations.validateDBUpdateQueryError(err));
        })
    }).catch(err => {
        console.error(err)
        return callback(err);
    })
}

function studentsThesisDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new StudentsThesis,data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        db.query(`
            DELETE FROM students_thesis WHERE student_batch_id='${data.student_batch_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `deleted ${data.student_batch_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record ${data.student_batch_id} does not exist`
                    });
                }
            } else {
                if (callback) {
                    callback({
                        code: 500, 
                        status: 'INTERNAL ERROR',
                        message: `${res.rowCount} rows deleted`
                    });
                }
            }
        }).catch(err => {
            console.error(err)
            if (callback) {
                callback(validations.validateDBDeleteQueryError(err));
            }
        })
    }
}

function studentsThesisUpdateGrade(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new StudentsThesis,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        UPDATE students_thesis SET
        grade = '${data.grade}',
        completion_timestamp = ${data.completion_timestamp},
        grade_change_logs = grade_change_logs || '"${new Date().getTime()} ${data.user_id} ${data.grade}"'
        WHERE student_batch_id = '${data.student_batch_id}';
    `).then(res => {
        if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `updated record in db` });
        else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record student_batch_id=${data.student_batch_id} does not exist` });
        else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBUpdateQueryError(err));
    })
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);
    if (['students_thesis_insert','students_thesis_update'].includes(notification.channel)) {
        db.query(`SELECT * FROM students_thesis WHERE student_batch_id='${payload.student_batch_id}'`)
        .then(res => {
            if (res.rowCount == 1) {
                event_emitter.emit('notifyAll', {event: 'studentsThesis/listener/changed', data: res.rows[0]})
            }
        }).catch(console.error)
    }
    
    if (['students_thesis_delete'].includes(notification.channel)) {
        event_emitter.emit('notifyAll', {event: 'studentsThesis/listener/changed', data: payload[0] || payload})
    }
})

module.exports = {
    studentsThesisFetch,
    studentsThesisCreate,
    studentsThesisUpdate,
    studentsThesisUpdateGrade,
    studentsThesisDelete,
    StudentsThesis
}