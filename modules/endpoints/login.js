const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes');
const { emailVerificationCode } = require('../email_code_verification');

class Login {
    name = 'Login';
    description = 'Endpoints for user login'
    data_types = {
        s_no: new DataTypes(true).autonumber,
        user_id: new DataTypes(true).uuid,
        username: new DataTypes(true,['login/auth']).string,
        password: new DataTypes(true,['login/auth']).string,
        permission_level: new DataTypes(true).number,
        user_type: new DataTypes(true,[],['login/auth'],false,'admin | pga | student | teacher').string,
        login_token: new DataTypes(true,['login/auth']).uuid,
    }
}

function loginAuth(data, callback) {
    console.log(`[${data.event}] called, data received: `, data)

    db.query(`SELECT * FROM users WHERE login_token='${data.login_token}';`)
    .then(res => {
        if (res.rowCount == 1) return callback({ code: 200, status: 'OK', data: res.rows[0] });

        const validator = validations.validateRequestData(data,new Login,data.event)
        if (!validator.valid) return callback({ code: 400, status: 'BAD REQUEST', message: validator.reason });

        db.query(`
            UPDATE users SET login_token = '${data.login_token}' WHERE 
            username = '${data.username.toLowerCase()}' 
            AND password = '${data.password}' 
            ${['admin','pga'].includes(data.username.toLowerCase()) ? '' : `AND user_type = '${data.user_type}'`}
            returning *;
        `).then(res => {
            if (res.rowCount == 0) return callback({ code: 402, status: 'INVALID CREDENTIALS', message: 'Username or password is invalid' });
            else if (res.rowCount == 1) return callback({ code: 200, status: 'OK', data: res.rows[0] });
            else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res[0].rowCount} rows received while updating record` });
        }).catch(err => {
            console.log(`[${data.event}] internal error: ${err}`)
            callback(validations.validateDBUpdateQueryError(err));
        })
    }).catch((err) => callback(validations.validateDBSelectQueryError(err)))
}

module.exports = {
    loginAuth,
    Login
}
