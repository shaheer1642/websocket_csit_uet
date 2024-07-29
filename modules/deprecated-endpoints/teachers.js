const db = require('../db');
const uuid = require('uuid');
const validations = require('../validations');
const { DataTypes } = require('../classes/DataTypes')
const { event_emitter } = require('../event_emitter');
const { uploadDocumentsFromArray } = require('./documents');
const { uploadFile } = require('../aws/aws');
const { formatCNIC, generateRandom1000To9999, escapeDBCharacters } = require('../functions');
const { hashPassword } = require('../hashing');

class Teachers {
    name = 'Teachers';
    description = 'Endpoints for creating teacher'
    data_types = {
        teacher_id: new DataTypes(true, ['teachers/update', 'teachers/delete'], ['teachers/fetch']).uuid,
        cnic: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, '1730155555555').string,
        teacher_name: new DataTypes(true, ['teachers/create'], ['teachers/update']).string,
        teacher_gender: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, 'male').string,
        digital_signature: new DataTypes(true, [], ['teachers/update'], false, 'image-buffer').any,
        areas_of_interest: new DataTypes(true, [], ['teachers/update']).array,
        // teacher_department_id: new DataTypes(true, ['teachers/create'], ['teachers/update']).string,
        qualification: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, 'male').string,
        designation: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, 'male').string,
        teacher_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
        user_id: new DataTypes(true).uuid,
        username: new DataTypes(true).string,
        password: new DataTypes(true).string,
        user_type: new DataTypes(true).string,
        user_email: new DataTypes(true, [], ['teachers/update', 'teachers/create']).email,
    }
}

function teachersFetch(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    if (!callback) return

    const validator = validations.validateRequestData(data, new Teachers, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    var where_clauses = []
    if (data.teacher_id) where_clauses.push(`T.teacher_id = '${data.teacher_id}'`)

    db.query(`
        SELECT 
            T.*, 
            U.*,
            (SELECT count(SC.sem_course_id) FROM semesters_courses SC WHERE SC.teacher_id = T.teacher_id) AS courses_taught,
            (SELECT count(ST.student_batch_id) FROM students_thesis ST JOIN students_batch SB ON SB.student_batch_id = ST.student_batch_id JOIN batches B ON B.batch_id = SB.batch_id WHERE ST.supervisor_id = T.teacher_id AND ST.grade NOT IN ('N','I') AND B.degree_type = 'ms') AS ms_students_supervised,
            (SELECT count(ST.student_batch_id) FROM students_thesis ST JOIN students_batch SB ON SB.student_batch_id = ST.student_batch_id JOIN batches B ON B.batch_id = SB.batch_id WHERE ST.supervisor_id = T.teacher_id AND ST.grade NOT IN ('N','I') AND B.degree_type = 'phd') AS phd_students_supervised,
            (SELECT count(ST.student_batch_id) FROM students_thesis ST JOIN students_batch SB ON SB.student_batch_id = ST.student_batch_id JOIN batches B ON B.batch_id = SB.batch_id WHERE ST.supervisor_id = T.teacher_id AND ST.grade IN ('N','I') AND B.degree_type = 'ms') AS ms_students_under_supervision,
            (SELECT count(ST.student_batch_id) FROM students_thesis ST JOIN students_batch SB ON SB.student_batch_id = ST.student_batch_id JOIN batches B ON B.batch_id = SB.batch_id WHERE ST.supervisor_id = T.teacher_id AND ST.grade IN ('N','I') AND B.degree_type = 'phd') AS phd_students_under_supervision
        FROM teachers T
        JOIN users U ON U.user_id = T.teacher_id
        ${where_clauses.length > 0 ? 'WHERE' : ''}
        ${where_clauses.join(' AND ')}
        ORDER BY T.teacher_name ASC;
    `).then(res => {
        return callback({ code: 200, status: 'OK', data: res.rows })
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function teachersCreate(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    const validator = validations.validateRequestData(data, new Teachers, data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400,
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        if (!data.cnic && !data.reg_no) return callback({ code: 400, status: 'BAD REQUEST', message: 'Both CNIC and Reg No cannot be empty' });
        data.cnic = data.cnic?.toString().toLowerCase()
        data.reg_no = data.reg_no?.toString().toLowerCase()
        if (data.cnic) {
            data.cnic = formatCNIC(data.cnic)
            if (!data.cnic) return callback({ code: 400, status: 'BAD REQUEST', message: 'CNIC must be exactly 13 characters long' });
        }
        const default_password = generateRandom1000To9999()
        db.query(`
            WITH query_one AS ( 
                INSERT INTO users (username, password, default_password, user_type, user_email) 
                VALUES (
                    '${data.reg_no || data.cnic}',
                    '${hashPassword(default_password)}',
                    '${default_password}',
                    'teacher',
                    ${data.user_email ? `'${data.user_email}'` : null}
                ) 
                RETURNING user_id 
            )
            INSERT INTO teachers (teacher_id, cnic, reg_no, teacher_name, teacher_gender, qualification, designation, teacher_department_id) 
            VALUES (
                ( select user_id from query_one ),
                ${data.cnic ? `'${data.cnic}'` : null},
                ${data.reg_no ? `'${data.reg_no}'` : null},
                '${data.teacher_name}',
                ${data.teacher_gender ? `'${data.teacher_gender}'` : null},
                ${data.qualification ? `'${escapeDBCharacters(data.qualification)}'` : null},
                ${data.designation ? `'${data.designation}'` : null},
                '${data.teacher_department_id}'
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
            console.error(err)
            if (callback) {
                callback(validations.validateDBInsertQueryError(err));
            }
        })
    }
}

function teachersDelete(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    const validator = validations.validateRequestData(data, new Teachers, data.event)
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
            DELETE FROM users WHERE user_id='${data.teacher_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                if (callback) {
                    callback({
                        code: 200,
                        status: 'OK',
                        message: `deleted ${data.teacher_id} record from db`
                    });
                }
            } else if (res.rowCount == 0) {
                if (callback) {
                    callback({
                        code: 400,
                        status: 'BAD REQUEST',
                        message: `record ${data.teacher_id} does not exist`
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

async function teachersUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new Teachers, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    if (data.cnic) {
        data.cnic = formatCNIC(data.cnic)
        if (!data.cnic) return callback({ code: 400, status: 'BAD REQUEST', message: 'CNIC must be exactly 13 characters long' });
    }

    var update_clauses = []
    if (data.teacher_name) update_clauses.push(`teacher_name = '${data.teacher_name}'`)
    if (data.teacher_gender) update_clauses.push(`teacher_gender = '${data.teacher_gender}'`)
    if (data.qualification) update_clauses.push(`qualification = '${escapeDBCharacters(data.qualification)}'`)
    if (data.designation) update_clauses.push(`designation = '${data.designation}'`)
    if (data.cnic) update_clauses.push(`cnic = '${data.cnic}'`)
    if (data.reg_no) update_clauses.push(`reg_no = '${data.reg_no}'`)
    if (data.areas_of_interest) update_clauses.push(`areas_of_interest = '${JSON.stringify(data.areas_of_interest)}'`)
    if (data.teacher_department_id) update_clauses.push(`teacher_department_id = '${data.teacher_department_id}'`)
    if (data.digital_signature) {
        console.log('digital_signature detected')
        const fileUrl = await uploadFile('digital_signature', data.digital_signature).catch(console.error)
        console.log('fileUrl', fileUrl)
        if (fileUrl) update_clauses.push(`digital_signature = '${fileUrl}'`)
    }
    if (update_clauses.length == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `No valid parameters found in requested data.` });

    db.query(
        data.cnic || data.reg_no ?
            `WITH query_one AS ( 
            UPDATE teachers SET
            ${update_clauses.join(',')}
            WHERE teacher_id = '${data.teacher_id}'
            RETURNING cnic, reg_no
        )
        UPDATE users SET 
        username = ( select COALESCE(cnic, reg_no) from query_one ) 
        ${data.user_email ? `,user_email = '${data.user_email}'` : ''}
        WHERE user_id = '${data.teacher_id}';`
            :
            `UPDATE teachers SET
        ${update_clauses.join(',')}
        WHERE teacher_id = '${data.teacher_id}';`
    ).then(res => {
        if (res.rowCount == 1) {
            if (callback) {
                callback({
                    code: 200,
                    status: 'OK',
                    message: `updated ${data.teacher_id} record in db`
                });
            }
        } else if (res.rowCount == 0) {
            if (callback) {
                callback({
                    code: 400,
                    status: 'BAD REQUEST',
                    message: `record ${data.teacher_id} does not exist`
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
        console.error(err)
        if (callback) {
            callback(validations.validateDBUpdateQueryError(err));
        }
    })
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);

    if (notification.channel == 'teachers_insert') {
        db.query(`
            SELECT * FROM teachers
            JOIN users ON users.user_id = teachers.teacher_id
            WHERE teachers.teacher_id = '${payload.teacher_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                event_emitter.emit('notifyAll', { event: 'teachers/listener/insert', data: res.rows[0] })
            }
        }).catch(console.error)
    }
    if (notification.channel == 'teachers_update') {
        db.query(`
            SELECT * FROM teachers
            JOIN users ON users.user_id = teachers.teacher_id
            WHERE teachers.teacher_id = '${payload[0].teacher_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                event_emitter.emit('notifyAll', { event: 'teachers/listener/update', data: res.rows[0] })
            }
        }).catch(console.error)
    }
    if (notification.channel == 'teachers_delete') {
        event_emitter.emit('notifyAll', { event: 'teachers/listener/delete', data: payload })
    }
})

module.exports = {
    teachersFetch,
    teachersCreate,
    teachersDelete,
    teachersUpdate,
    Teachers
}