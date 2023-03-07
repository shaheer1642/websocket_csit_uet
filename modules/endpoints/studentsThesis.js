const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class StudentsThesis {
    name = 'Students Thesis';
    description = 'Endpoints for assigning thesis to students'
    data_types = {
        student_thesis_id: new DataTypes(true,['studentsThesis/updateGrade'],['studentsThesis/fetch']).uuid,
        student_batch_id: new DataTypes(true,['studentsThesis/create'],['studentsThesis/fetch']).uuid,
        thesis_type: new DataTypes(true,['studentsThesis/create'],['studentsThesis/fetch']).string,
        thesis_title: new DataTypes(true,['studentsThesis/create'],[]).string,
        grade: new DataTypes(true,['studentsThesis/updateGrade'],['studentsThesis/fetch'],false,'B').string,
        supervisor_id: new DataTypes(true,[],['studentsThesis/create','studentsThesis/update']).uuid,
        co_supervisor_id: new DataTypes(true,[],['studentsThesis/create','studentsThesis/update']).uuid,
        document_urls: new DataTypes(true,[],['studentsThesis/update']).json,
        internal_examiner: new DataTypes(true,[],['studentsThesis/update']).string,
        external_examiner: new DataTypes(true,[],['studentsThesis/update']).string,
        boasar_notification_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        committee_notification_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        defense_day_timestamp: new DataTypes(true,[],['studentsThesis/update']).unix_timestamp_milliseconds,
        undertaking_timestamp: new DataTypes(true,[],[]).unix_timestamp_milliseconds,
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
        if (data.student_thesis_id) where_clauses.push(`ST.student_thesis_id = '${data.student_thesis_id}'`)
        if (data.student_batch_id) where_clauses.push(`ST.student_batch_id = '${data.student_batch_id}'`)
        if (data.grade) where_clauses.push(`ST.grade = '${data.grade}'`)
        if (data.thesis_type) where_clauses.push(`ST.thesis_type = '${data.thesis_type}'`)
        db.query(`
            SELECT * FROM students_thesis ST
            JOIN students S ON S.student_id = (select student_id from students_batch SB where SB.student_batch_id = ST.student_batch_id)
            JOIN batches B ON B.batch_id = (select batch_id from students_batch SB where SB.student_batch_id = ST.student_batch_id)
            ${where_clauses.length > 0 ? 'WHERE':''}
            ${where_clauses.join(' AND ')}
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: res.rows
            })
        }).catch(err => {
            console.log(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
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
        db.query(`
            INSERT INTO students_thesis (student_batch_id, thesis_type, thesis_title)
            VALUES (
                '${data.student_batch_id}',
                '${data.thesis_type}',
                '${data.thesis_title}'
            );
        `).then(res => {
            if (!callback) return
            if (res.rowCount == 1) {
                callback({
                    code: 200, 
                    status: 'OK',
                    message: 'added record to db'
                });
            } else {
                callback({
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
            WHERE student_thesis_id = '${data.student_thesis_id}' AND student_id = '${data.student_id}';
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200, 
                        status: 'OK',
                        message: `updated sem_course=${data.student_thesis_id} student=${data.student_id} record in db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400, 
                        status: 'BAD REQUEST',
                        message: `record sem_course=${data.student_thesis_id} student=${data.student_id} does not exist`
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
        db.query(`SELECT * FROM students_thesis WHERE student_thesis_id='${payload.student_thesis_id}'`)
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
    studentsThesisUpdateGrade,
    StudentsThesis
}