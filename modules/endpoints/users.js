const {db} = require('../db_connection');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter');
const { emailVerificationCode, verifyVerificationCode } = require('../email_code_verification');
const { uploadFile } = require('../aws/aws');

class Users {
    name = 'Users';
    description = 'Endpoints for users'
    data_types = {
        user_id: new DataTypes(true,['users/resetPassword'],[]).uuid,
        fetch_user_id: new DataTypes(true,[],['users/fetch']).uuid,
        name: new DataTypes(true,[],[]).string,
        user_type: new DataTypes(true,[],['users/sendEmailVerificationCode']).string,
        login_token: new DataTypes(false,['users/FCMTokenUpdate'],[]).uuid,
        fcm_token: new DataTypes(false,['users/FCMTokenUpdate'],[]).string,
        user_email: new DataTypes(true,['users/updateEmail'],['users/sendEmailVerificationCode']).email,
        username: new DataTypes(true,[],['users/sendEmailVerificationCode']).string,
        email_verification_code: new DataTypes(false,['users/updateEmail','users/resetPassword'],[]).string,
        current_password: new DataTypes(false,['users/changePassword'],[]).string,
        new_password: new DataTypes(false,['users/changePassword','users/resetPassword'],[]).string,
        avatar: new DataTypes(false,['users/updateAvatar'],[]).any,
    }
}

function usersFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Users,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });
    
    var where_clauses = []
    if (data.fetch_user_id) where_clauses.push(`users.user_id = '${data.fetch_user_id}'`)

    db.query(`
        SELECT * FROM users WHERE user_type NOT IN ('student','teacher')
        ${where_clauses.length > 0 ? 'AND ' + where_clauses.join(' AND '):''}
        ;
        SELECT * FROM users JOIN students on students.student_id = users.user_id
        ${where_clauses.length > 0 ? 'WHERE':''}
        ${where_clauses.join(' AND ')}
        ;
        SELECT * FROM users JOIN teachers on teachers.teacher_id = users.user_id
        ${where_clauses.length > 0 ? 'WHERE':''}
        ${where_clauses.join(' AND ')}
        ;
    `).then(res => {
        const users_list = []

        res[0].rows.concat(res[1].rows.concat(res[2].rows)).forEach(user => {
            users_list.push({
                ...user,
                name:  user.student_name || user.teacher_name || user.user_type,
            })
        })

        return callback({ code: 200, status: 'OK', data: users_list})
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

function usersFCMTokenUpdate(data,callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data,new Users,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    db.query(`
        UPDATE users SET 
        fcm_tokens = fcm_tokens || '[${JSON.stringify({timestamp: new Date().getTime(), token: data.fcm_token})}]'
        WHERE login_token = '${data.login_token}' AND NOT(fcm_tokens @> '[{"token": "${data.fcm_token}"}]');
    `).then(res => {
        if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'updated token'})
        else return callback({ code: 400, status: 'BAD REQUEST', message: 'could not update record in db. maybe token already exists'})
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBUpdateQueryError(err));
    })
}

function usersSendEmailVerificationCode(data,callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data,new Users,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    if (data.username) {
        if (!['admin','pga'].includes(data.username) && !data.user_type) return callback({ code: 400, status: 'BAD REQUEST', message: 'user_type not provided with the username' });
        db.query(`
            SELECT * FROM users WHERE 
            username = '${data.username}'
            ${['admin','pga'].includes(data.username) ? '' : `AND user_type = '${data.user_type}'`};
        `).then(res => {
            const user = res.rows[0]
            if (!user) return callback({ code: 400, status: 'BAD REQUEST', message: 'No user registered with given info' });
            emailVerificationCode(user.user_id,user.user_email).then(() => {
                return callback({ code: 200, status: 'OK', data: user, message: 'email sent'})
            }).catch(err => {
                return callback({ code: 500, status: 'ERROR', message: err.message || err})
            })
        }).catch(err => {
            console.error(err)
            return callback(validations.validateDBSelectQueryError(err));
        })
    } else if (data.user_email) {
        db.query(`
            SELECT * FROM users WHERE user_email = '${data.user_email}';
        `).then(res => {
            const user = res.rows[0]
            if (!user) return callback({ code: 400, status: 'BAD REQUEST', message: 'No user registered with given info' });
            emailVerificationCode(data.user_id,data.user_email).then(() => {
                return callback({ code: 200, status: 'OK', data: user, message: 'email sent'})
            }).catch(err => {
                return callback({ code: 500, status: 'ERROR', message: err.message || err})
            })
        }).catch(err => {
            console.error(err)
            return callback(validations.validateDBSelectQueryError(err));
        })
    } else {
        return callback({ code: 400, status: 'BAD REQUEST', message: 'No username or email provided'})
    }
}

function usersUpdateEmail(data,callback) {
    console.log(`[${data.event}] called data received:`, data)

    const validator = validations.validateRequestData(data,new Users,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

    if (verifyVerificationCode(data.user_id,data.email_verification_code)) {
        db.query(`
            UPDATE users SET 
            user_email = '${data.user_email}'
            WHERE login_token = '${data.login_token}';
        `).then(res => {
            if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'updated email'})
            else return callback({ code: 500, status: 'INTERNAL ERROR', message: 'could not update record in db'})
        }).catch(err => {
            console.error(err)
            return callback(validations.validateDBUpdateQueryError(err));
        })
    } else return callback({ code: 400, status: 'BAD REQUEST', message: 'Invalid verification code provided'})
}

function usersChangePassword(data, callback) {
    console.log(`[${data.event}] called, data received: `, data)

    const validator = validations.validateRequestData(data,new Users,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });
    
    db.query(`
        UPDATE users SET password = '${data.new_password}' WHERE user_id = '${data.user_id}' AND password = '${data.current_password}';
        SELECT * FROM users WHERE user_id = '${data.user_id}';
    `).then(res => {
        if (res[0].rowCount == 1) return callback({ code: 200, status: 'OK', message: 'password reset successful' });
        else {
            if (res[1]?.rows[0]?.password != data.current_password) return callback({ code: 401, status: 'BAD REQUEST', message: `Current password is incorrect` });
            else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res[0].rowCount} rows received while updating record` });
        }
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBUpdateQueryError(err));
    })
}

function usersResetPassword(data, callback) {
    console.log(`[${data.event}] called, data received: `, data)

    const validator = validations.validateRequestData(data,new Users,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });
    
    if (verifyVerificationCode(data.user_id,data.email_verification_code)) {
        db.query(`
            UPDATE users SET password = '${data.new_password}' WHERE user_id = '${data.user_id}';
        `).then(res => {
            if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'password reset successful' });
            else return callback({ code: 500, status: 'BAD REQUEST', message: 'could not find that record in db'})
        }).catch(err => {
            console.error(err)
            return callback(validations.validateDBUpdateQueryError(err));
        })
    } else return callback({ code: 400, status: 'BAD REQUEST', message: 'Invalid verification code provided'})
}

async function usersUpdateAvatar(data, callback) {
    console.log(`[${data.event}] called, data received: `, data)

    const validator = validations.validateRequestData(data,new Users,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });
    
    const fileUrl = await uploadFile('avatar', data.avatar).catch(console.error)
    if (!fileUrl) return callback({ code: 500, status: 'INTERNAL ERROR', message: 'Error uploading file' })
        
    db.query(`
        UPDATE users SET avatar = '${fileUrl}' WHERE user_id = '${data.user_id}';
    `).then(res => {
        if (res.rowCount == 1) return callback({ code: 200, status: 'OK', message: 'avatar updated' });
        else return callback({ code: 400, status: 'BAD REQUEST', message: `record not found` });
    }).catch(err => {
        console.error(err)
        return callback(validations.validateDBUpdateQueryError(err));
    })
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);
    
    if (notification.channel == 'users_insert') {
        event_emitter.emit('notifyAll', {event: 'users/listener/insert', data: payload})
    }
    if (notification.channel == 'users_update') {
        event_emitter.emit('notifyAll', {event: 'users/listener/update', data: payload[0]})
    }
    if (notification.channel == 'users_delete') {
        event_emitter.emit('notifyAll', {event: 'users/listener/delete', data: payload})
    }
})

module.exports = {
    usersFetch,
    usersFCMTokenUpdate,
    usersSendEmailVerificationCode,
    usersUpdateEmail,
    usersChangePassword,
    usersResetPassword,
    usersUpdateAvatar,
    Users
}