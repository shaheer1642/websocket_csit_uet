const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter');
const { documentsCreate, uploadDocumentsFromArray } = require('./documents');

class StudentsThesis {
    name = 'Students Thesis';
    description = 'Endpoints for assigning thesis to students'
    data_types = {
        student_batch_id: new DataTypes(true,['studentsThesis/create','studentsThesis/updateGrade','studentsThesis/update','studentsThesis/delete'],['studentsThesis/fetch']).uuid,
        thesis_type: new DataTypes(true,['studentsThesis/create'],['studentsThesis/fetch','studentsThesis/update']).string,
        thesis_title: new DataTypes(true,['studentsThesis/create'],['studentsThesis/update']).string,
        grade: new DataTypes(true,['studentsThesis/updateGrade'],['studentsThesis/fetch'],false,'B').string,
        supervisor_id: new DataTypes(true,['studentsThesis/create'],['studentsThesis/update']).uuid,
        co_supervisor_id: new DataTypes(true,[],['studentsThesis/create','studentsThesis/update']).uuid,
        undertaking_timestamp: new DataTypes(true,[],[]).unix_timestamp_milliseconds,
        internal_examiner: new DataTypes(true,[],['studentsThesis/update']).string,
        external_examiner: new DataTypes(true,[],['studentsThesis/update']).string,
        boasar_notification_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        committee_notification_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        defense_day_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        // proposal_completed: new DataTypes(true,[],['studentsThesis/update']).boolean,
        proposal_documents: new DataTypes(true,[],['studentsThesis/update']).array,
        thesis_defense_documents: new DataTypes(true,[],['studentsThesis/update']).array,
        thesis_submission_documents: new DataTypes(true,[],['studentsThesis/update']).array,
        post_defense_documents: new DataTypes(true,[],['studentsThesis/update']).array,
        post_thesis_documents: new DataTypes(true,[],['studentsThesis/update']).array,
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
                        JOIN students S ON S.student_id = (select student_id from students_batch SB where SB.student_batch_id = ST.student_batch_id)
                        JOIN batches B ON B.batch_id = (select batch_id from students_batch SB where SB.student_batch_id = ST.student_batch_id)
                        ${where_clauses.length > 0 ? 'WHERE':''}
                        ${where_clauses.join(' AND ')}
                        ORDER BY ST.undertaking_timestamp DESC;
                    `
                }).join('\n')
            }
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: res.reduce((arr,obj) => arr.concat(obj.rows),[])
            })
        }).catch(err => {
            console.log(err)
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
            console.log(err)
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
            db.query(`
                INSERT INTO students_thesis_${res.degree_type}_${data.thesis_type} (student_batch_id, thesis_type, thesis_title, supervisor_id, co_supervisor_id)
                VALUES (
                    '${data.student_batch_id}',
                    '${data.thesis_type}',
                    '${data.thesis_title}',
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
                console.log(err)
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
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400, 
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
        return
    } else {
        fetchStudentDegreeAndThesisTypes(data.student_batch_id)
        .then(async res => {
            const child_table = `students_thesis_${res.degree_type}_${res.thesis_type}`
            
            var update_clauses = []
            if (data.supervisor_id) update_clauses.push(`supervisor_id = '${data.supervisor_id}'`)
            if (data.co_supervisor_id) update_clauses.push(`co_supervisor_id = '${data.co_supervisor_id}'`)
            if (data.thesis_type) update_clauses.push(`thesis_type = '${data.thesis_type}'`)
            if (data.thesis_title) update_clauses.push(`thesis_title = '${data.thesis_title}'`)
            if (data.internal_examiner) update_clauses.push(`internal_examiner = '${data.internal_examiner}'`)
            if (data.external_examiner) update_clauses.push(`external_examiner = '${data.external_examiner}'`)
            if (data.boasar_notification_timestamp) update_clauses.push(`boasar_notification_timestamp = ${data.boasar_notification_timestamp}`)
            if (data.committee_notification_timestamp) update_clauses.push(`committee_notification_timestamp = ${data.committee_notification_timestamp}`)
            if (data.defense_day_timestamp) update_clauses.push(`defense_day_timestamp = ${data.defense_day_timestamp}`)
            // if (data.proposal_completed != undefined) update_clauses.push(`proposal_completed = ${data.proposal_completed}`)
            if (data.proposal_documents) {
                const document_ids = await uploadDocumentsFromArray(data.proposal_documents)
                console.log(document_ids)
                update_clauses.push(`proposal_documents = '${JSON.stringify(document_ids)}'`)
            }
            if (data.thesis_defense_documents) {
                const document_ids = await uploadDocumentsFromArray(data.thesis_defense_documents)
                console.log(document_ids)
                update_clauses.push(`thesis_defense_documents = '${JSON.stringify(document_ids)}'`)
            }
            if (data.thesis_submission_documents) {
                const document_ids = await uploadDocumentsFromArray(data.thesis_submission_documents)
                console.log(document_ids)
                update_clauses.push(`thesis_submission_documents = '${JSON.stringify(document_ids)}'`)
            }
            if (data.post_defense_documents) {
                const document_ids = await uploadDocumentsFromArray(data.post_defense_documents)
                console.log(document_ids)
                update_clauses.push(`post_defense_documents = '${JSON.stringify(document_ids)}'`)
            }
            if (data.post_thesis_documents) {
                const document_ids = await uploadDocumentsFromArray(data.post_thesis_documents)
                console.log(document_ids)
                update_clauses.push(`post_thesis_documents = '${JSON.stringify(document_ids)}'`)
            }
            if (update_clauses.length == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `No valid parameters found in requested data.`,
                    });
                }
                return
            }
            db.query(`
                UPDATE ${child_table} SET
                ${update_clauses.join(',')}
                WHERE student_batch_id = '${data.student_batch_id}';
            `).then(res => {
                if (res.rowCount == 1) {
                    if (callback) {
                        callback({
                            code: 200, 
                            status: 'OK',
                            message: `updated ${data.student_batch_id} record in db`
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
                            message: `${res.rowCount} rows updated`
                        });
                    }
                }
            }).catch(err => {
                console.log(err)
                if (callback) {
                    callback(validations.validateDBUpdateQueryError(err));
                }
            })
        }).catch(err => {
            if (callback) {
                callback(err);
            }
        })
    }
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
            console.log(err)
            if (callback) {
                callback(validations.validateDBDeleteQueryError(err));
            }
        })
    }
}

function studentsThesisUpdateGrade(data, callback) {
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
        return
    } else {
        var update_clauses = []
        if (data.grade) update_clauses.push(`grade = '${data.grade}'`)
        if (update_clauses.length == 0) {
            if (callback) {
                callback({
                    code: 400, 
                    status: 'BAD REQUEST',
                    message: `No valid parameters found in requested data.`,
                });
            }
            return
        }
        db.query(`
            UPDATE students_thesis SET
            grade = '${data.grade}',
            grade_assignment_timestamp = ${new Date().getTime()},
            grade_assigned_by = '${data.user_id}',
            grade_change_logs = grade_change_logs || '"${new Date().getTime()} ${data.user_id} ${data.grade}"'
            WHERE student_batch_id = '${data.student_batch_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record student_batch_id=${data.student_batch_id} does not exist`
                    });
                }
            } else {
                if (callback) {
                    callback({
                        code: 500, 
                        status: 'INTERNAL ERROR',
                        message: `${res.rowCount} rows updated`
                    });
                }
            }
        }).catch(err => {
            console.log(err)
            if (callback) {
                callback(validations.validateDBUpdateQueryError(err));
            }
        })
    }
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