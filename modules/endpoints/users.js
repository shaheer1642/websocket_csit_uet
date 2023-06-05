const {db} = require('../db_connection');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class Users {
    name = 'Users';
    description = 'Endpoints for users'
    data_types = {
        fetch_user_id: new DataTypes(true,[],['users/fetch']).uuid,
        name: new DataTypes(true,[],[]).string,
        user_type: new DataTypes(true,[],[]).string,
        login_token: new DataTypes(false,['users/FCMTokenUpdate'],[]).uuid,
        fcm_token: new DataTypes(false,['users/FCMTokenUpdate'],[]).string,
    }
}

function usersFetch(data, callback) {
    console.log(`[${data.event}] called data received:`,data)

    const validator = validations.validateRequestData(data,new Users,data.event)
    if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });
    
    var where_clauses = []
    if (data.fetch_user_id) where_clauses.push(`users.user_id = '${data.fetch_user_id}'`)

    db.query(`
        SELECT * FROM users WHERE user_type NOT IN ('student','teacher');
        SELECT * FROM users JOIN students on students.student_id = users.user_id;
        SELECT * FROM users JOIN teachers on teachers.teacher_id = users.user_id;
        ${where_clauses.length > 0 ? 'WHERE':''}
        ${where_clauses.join(' AND ')}
    `).then(res => {
        const users_list = []

        res[0].rows.concat(res[1].rows.concat(res[2].rows)).forEach(user => {
            users_list.push({
                user_id: user.user_id,
                name:  user.student_name || user.teacher_name || user.user_type,
                user_type: user.user_type
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
    Users
}