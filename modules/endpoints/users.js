const {db} = require('../db_connection');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')
const {event_emitter} = require('../event_emitter')

class Users {
    name = 'Students';
    description = 'Endpoints for creating student'
    data_types = {
        fetch_user_id: new DataTypes(true,[],['users/fetch']).uuid,
        name: new DataTypes(true,[],[]).string,
        user_type: new DataTypes(true,[],[]).string,
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
        console.log(err)
        return callback(validations.validateDBSelectQueryError(err));
    })
}

module.exports = {
    usersFetch,
    Users
}