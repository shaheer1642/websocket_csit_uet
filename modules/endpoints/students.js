const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter');
const { generateRandom1000To9999, formatCNIC, convertUpper } = require('../functions');
const { hashPassword } = require('../hashing');
const { calculateTranscript } = require('../grading_functions');

class Students {
    name = 'Students';
    description = 'Endpoints for creating student'
    data_types = {
        serial: new DataTypes(true).autonumber,
        student_id: new DataTypes(true,['students/update','students/delete'],['students/fetch']).uuid,
        cnic: new DataTypes(true,[],['students/create','students/update'],false,'1730155555555').string,
        reg_no: new DataTypes(true,[],['students/create','students/update'],false,'19pwbcs0000').string,
        student_name: new DataTypes(true,['students/create'],['students/update']).string,
        student_father_name: new DataTypes(true,['students/create'],['students/update']).string,
        student_gender: new DataTypes(true,[],['students/create','students/update'],false,'male').string,
        student_admission_status: new DataTypes(true,[],['students/create','students/update'],false,'open_merit').string,
        student_contact_no: new DataTypes(true,[],['students/create','students/update'],false,'03123456789').string,
        student_address: new DataTypes(true,[],['students/update','students/create'],false,'street#5, abc road, abc area, xyz city').string,
        student_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
        user_email: new DataTypes(true,[],['students/update','students/create']).email,
        user_id: new DataTypes(true).uuid,
        username: new DataTypes(true).string,
        password: new DataTypes(true).string,
        user_type: new DataTypes(true).string,
        student_batch_id: new DataTypes(true,['students/completeDegree','students/transcript','students/freezeSemester','students/cancelAdmission']).uuid,
        batch_id: new DataTypes(true,['students/create','students/update','students/delete'],['students/fetch']).uuid,
        batch_no: new DataTypes(true).string,
        joined_semester: new DataTypes(true).string,
        degree_type: new DataTypes(true).string,
        degree_completed: new DataTypes(true,['students/completeDegree']).boolean,
        semester_frozen: new DataTypes(true,['students/freezeSemester']).boolean,
        admission_cancelled: new DataTypes(true,['students/cancelAdmission']).boolean,
    }
}

function studentsFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    if (!callback) return
    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
    } else {
        var where_clauses = []
        if (data.batch_id) where_clauses.push(`batches.batch_id = '${data.batch_id}'`)
        if (data.student_id) where_clauses.push(`students.student_id = '${data.student_id}'`)
        if (data.reg_no) where_clauses.push(`students.reg_no = '${data.reg_no}'`)
        if (data.cnic) where_clauses.push(`students.cnic = '${data.cnic}'`)
        
        db.query(`
            SELECT * FROM students
            JOIN students_batch on students_batch.student_id = students.student_id
            JOIN batches on batches.batch_id = students_batch.batch_id
            JOIN users ON users.user_id = students.student_id
            ${where_clauses.length > 0 ? 'WHERE':''}
            ${where_clauses.join(' AND ')}
        `).then(res => {
            callback({
                code: 200, 
                status: 'OK',
                data: res.rows
            })
        }).catch(err => {
            console.error(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

function studentsTranscript(data, callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data, new Students, data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        SELECT * FROM students_courses SDC
        JOIN semesters_courses SMC ON SMC.sem_course_id = SDC.sem_course_id
        JOIN semesters SM ON SM.semester_id = SMC.semester_id
        JOIN students_batch SDB ON SDB.student_batch_id = SDC.student_batch_id
        JOIN batches B ON SDB.batch_id = B.batch_id
        JOIN students S ON S.student_id = SDB.student_id
        JOIN courses C ON C.course_id = SMC.course_id
        JOIN grades G ON SDC.grade = G.grade
        WHERE SDC.student_batch_id = '${data.student_batch_id}'
        ORDER BY SM.semester_start_timestamp ASC;
        SELECT * FROM students_thesis WHERE student_batch_id = '${data.student_batch_id}';
    `).then(res => {
        if (res[0].rowCount == 0) return callback({ code: 200, data: '<html><body><h4>No courses assigned yet</h4></body></html>' })
        const courses = res[0].rows
        const thesis = res[1].rows[0]
        const data = courses[0]
        const attributes = {
            reg_no: data.reg_no,
            cnic: data.cnic,
            student_name: data.student_name,
            student_father_name: data.student_father_name,
            degree_type: data.degree_type,
            department: `Computer Science & Information Technology`,
            specialization: convertUpper(data.batch_stream),
            thesis_title: data.thesis_title,
            thesis_grade: data.thesis_grade
        }
        const {semestersCourses, gpa} = calculateTranscript(courses)
        return callback({
            code: 200,
            data: {
                thesis,
                attributes,
                semestersCourses,
                gpa
            }
        })
    }).catch(err => {
        console.error(err)
        callback(validations.validateDBSelectQueryError(err));
    })
}

function studentsCreate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Students,data.event)
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
                    'student',
                    ${data.user_email ? `'${data.user_email}'` : null}
                ) 
                RETURNING user_id 
            ), query_two AS (
                INSERT INTO students (student_id, cnic, reg_no, student_name, student_father_name, student_gender, student_admission_status, student_address, student_contact_no) 
                VALUES (
                    ( select user_id from query_one ),
                    ${data.cnic ? `'${data.cnic}'`:null},
                    ${data.reg_no ? `'${data.reg_no}'`:null},
                    '${data.student_name}',
                    '${data.student_father_name}',
                    ${data.student_gender ? `'${data.student_gender.toLowerCase()}'` : null},
                    ${data.student_admission_status ? `'${data.student_admission_status.toLowerCase()}'` : null},
                    ${data.student_address ? `'${data.student_address}'` : null},
                    ${data.student_contact_no ? `'${data.student_contact_no}'` : null}
                )
            )
            INSERT INTO students_batch (student_id, batch_id)
            VALUES (
                ( select user_id from query_one ),
                '${data.batch_id}'
            );
        `).then(res => {
            if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'added record to db' });
            else return callback({ code: 500, status: 'INTERNAL ERROR', message: 'unexpected DB response' });
        }).catch(err => {
            if (err.code == '23505' && (err.constraint == 'students_cnic_ukey' || err.constraint == 'students_reg_no_ukey' || err.constraint == 'users_ukey2')) {
                db.query(`
                    INSERT INTO students_batch (student_id, batch_id)
                    VALUES (
                        ( select student_id from students WHERE cnic = '${data.cnic}' OR reg_no = '${data.reg_no}'),
                        '${data.batch_id}'
                    );
                `).then(res => {
                    if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'added record to db' });
                    else return callback({ code: 500, status: 'INTERNAL ERROR', message: 'unexpected DB response' });
                }).catch(err => {
                    console.error(err)
                    return callback(validations.validateDBInsertQueryError(err));
                })
            } else {
                console.error(err)
                return callback(validations.validateDBInsertQueryError(err));
            }
        })
    }
}

function studentsDelete(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        SELECT * FROM students_batch WHERE student_id = '${data.student_id}';
    `).then(res => {
        if (res.rowCount == 1 && res.rows.some(row => row.batch_id == data.batch_id)) {
            db.query(`
                DELETE FROM users WHERE user_id='${data.student_id}';
            `).then(res => {
                if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `deleted ${data.student_id} record from db` });
                else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record ${data.student_id} does not exist` });
                else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows deleted` });
            }).catch(err => {
                console.error(err)
                return callback(validations.validateDBDeleteQueryError(err));
            })
        } else if (res.rowCount > 1) {
            db.query(`
                DELETE FROM students_batch WHERE student_id='${data.student_id}' AND batch_id='${data.batch_id}';
            `).then(res => {
                if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: `deleted student_id=${data.student_id} batch_id=${data.batch_id} record from db` });
                else if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `record student_id=${data.student_id} batch_id=${data.batch_id} does not exist` });
                else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows deleted` });
            }).catch(err => {
                console.error(err)
                return callback(validations.validateDBDeleteQueryError(err));
            })
        } else return callback({ code: 500, status: 'INTERNAL ERROR', message: `Could not find that user` });
    }).catch(err => {
        console.error(err)
        if (callback) {
            callback(validations.validateDBDeleteQueryError(err));
        }
    })
}

function studentsUpdate(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    if (data.cnic) {
        data.cnic = formatCNIC(data.cnic)
        if (!data.cnic) return callback({ code: 400, status: 'BAD REQUEST', message: 'CNIC must be exactly 13 characters long' }); 
    }
    
    var update_clauses = []
    if (data.reg_no != undefined) update_clauses.push(`reg_no = ${data.reg_no ? `'${data.reg_no}'` : 'NULL'}`)
    if (data.cnic != undefined) update_clauses.push(`cnic = ${data.cnic ? `'${data.cnic}'` : 'NULL'}`)
    if (data.student_name) update_clauses.push(`student_name = '${data.student_name}'`)
    if (data.student_father_name) update_clauses.push(`student_father_name = '${data.student_father_name}'`)
    if (data.student_address != undefined) update_clauses.push(`student_address = ${data.student_address ? `'${data.student_address}'` : 'NULL'}`)
    if (data.student_contact_no != undefined) update_clauses.push(`student_contact_no = ${data.student_contact_no ? `'${data.student_contact_no}'` : 'NULL'}`)
    if (data.student_gender != undefined) update_clauses.push(`student_gender = ${data.student_gender ? `'${data.student_gender}'` : 'NULL'}`)
    if (data.student_admission_status != undefined) update_clauses.push(`student_admission_status = ${data.student_admission_status ? `'${data.student_admission_status}'` : 'NULL'}`)
    if (update_clauses.length == 0) return callback({ code: 400, status: 'BAD REQUEST', message: `No valid parameters found in requested data.`, })

    db.query(
        data.cnic || data.reg_no ?
        `WITH query_one AS ( 
            UPDATE students SET
            ${update_clauses.join(',')}
            WHERE student_id = '${data.student_id}'
            RETURNING reg_no, cnic
        )
        UPDATE users SET 
        username = ( select COALESCE(reg_no, cnic) from query_one ) 
        ${data.user_email ? `,user_email = '${data.user_email}'`:''} 
        WHERE user_id = '${data.student_id}';`
        :
        `UPDATE students SET
        ${update_clauses.join(',')}
        WHERE student_id = '${data.student_id}';`
    ).then(res => {
        if (res.rowCount == 1) {
            if (callback) {
                callback({
                    code: 200, 
                    status: 'OK',
                    message: `updated ${data.student_id} record in db`
                });
            }
        } else if (res.rowCount == 0) {
            if (callback) {
                callback({
                    code: 400, 
                    status: 'BAD REQUEST',
                    message: `record ${data.student_id} does not exist`
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

function studentsCompleteDegree(data,callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        UPDATE students_batch SET
        degree_completed = ${data.degree_completed}
        WHERE student_batch_id = '${data.student_batch_id}';
    `).then(res => {
        if (res.rowCount == 1) callback({ code: 200, status: 'OK', message: `updated record in db` });
        else if (res.rowCount == 0) callback({ code: 400, status: 'BAD REQUEST', message: `record does not exist` }); 
        else callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
    }).catch(err => {
        console.error(err)
        callback(validations.validateDBUpdateQueryError(err));
    })
}

function studentsFreezeSemester(data,callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        UPDATE students_batch SET
        semester_frozen = ${data.semester_frozen}
        WHERE student_batch_id = '${data.student_batch_id}';
    `).then(res => {
        if (res.rowCount == 1) callback({ code: 200, status: 'OK', message: `updated record in db` });
        else if (res.rowCount == 0) callback({ code: 400, status: 'BAD REQUEST', message: `record does not exist` }); 
        else callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
    }).catch(err => {
        console.error(err)
        callback(validations.validateDBUpdateQueryError(err));
    })
}

function studentsCancelAdmission(data,callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Students,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        UPDATE students_batch SET
        admission_cancelled = ${data.admission_cancelled}
        WHERE student_batch_id = '${data.student_batch_id}';
    `).then(res => {
        if (res.rowCount == 1) callback({ code: 200, status: 'OK', message: `updated record in db` });
        else if (res.rowCount == 0) callback({ code: 400, status: 'BAD REQUEST', message: `record does not exist` }); 
        else callback({ code: 500, status: 'INTERNAL ERROR', message: `${res.rowCount} rows updated` });
    }).catch(err => {
        console.error(err)
        callback(validations.validateDBUpdateQueryError(err));
    })
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);
    
    if (notification.channel == 'students_insert') {
        db.query(`
            SELECT * FROM students
            JOIN students_batch on students_batch.student_id = students.student_id
            JOIN batches on batches.batch_id = students_batch.batch_id
            JOIN users ON users.user_id = students.student_id
            WHERE students.student_id = '${payload.student_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                event_emitter.emit('notifyAll', {event: 'students/listener/insert', data: res.rows[0]})
            }
        }).catch(console.error)
    }
    if (notification.channel == 'students_update') {
        db.query(`
            SELECT * FROM students
            JOIN students_batch on students_batch.student_id = students.student_id
            JOIN batches on batches.batch_id = students_batch.batch_id
            JOIN users ON users.user_id = students.student_id
            WHERE students.student_id = '${payload[0].student_id}'
        `).then(res => {
            if (res.rowCount == 1) {
                event_emitter.emit('notifyAll', {event: 'students/listener/update', data: res.rows[0]})
            }
        }).catch(console.error)
    }
    if (notification.channel == 'students_delete') {
        event_emitter.emit('notifyAll', {event: 'students/listener/delete', data: payload})
    }

    if (notification.channel == 'students_batch_insert') {
        event_emitter.emit('notifyAll', {event: 'studentsBatch/listener/insert', data: payload})
    }
    if (notification.channel == 'students_batch_update') {
        event_emitter.emit('notifyAll', {event: 'studentsBatch/listener/update', data: payload[0]})
    }
    if (notification.channel == 'students_batch_delete') {
        event_emitter.emit('notifyAll', {event: 'studentsBatch/listener/delete', data: payload})
    }
})

module.exports = {
    studentsFetch,
    studentsCreate,
    studentsDelete,
    studentsUpdate,
    studentsCompleteDegree,
    studentsFreezeSemester,
    studentsCancelAdmission,
    studentsTranscript,
    Students
}