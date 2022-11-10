const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')

class Login {
    name = 'Login';
    description = 'Endpoints user login'
    subendpoints = {
        "login/": {
            call_example: ``,
            permission_level: ['ALL']
        },
        "login/resetPassword": {
            call_example: ``,
            permission_level: ['ALL']
        }
    }
    listeners = {
    }
    data_types = {
        s_no: new DataTypes(true).autonumber,
        user_id: new DataTypes(true).uuid,
        username: new DataTypes(true,['login/','login/resetPassword']).string,
        password: new DataTypes(true,['login/']).string,
        old_password: new DataTypes(true,['login/resetPassword']).string,
        new_password: new DataTypes(true,['login/resetPassword']).string,
        permission_level: new DataTypes(true).number,
        user_type: new DataTypes(true).string,
        login_token: new DataTypes(true).uuid,
    }
}

function login(data, callback) {
    if (!callback) return
    const event = 'login/'
    console.log(`[${event}] called, data received: ${data}`)
    const validator = validations.validateRequestData(data,new Login,event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
        return
    }
    db.query(`SELECT * FROM faculty`)
    .then(res => {
        const users = res.rows
        const matched_username = false
        const matched_password = false
        for (const user of users) {
            if (user.username.toLowerCase() == data.username) matched_username = true;
            if (!matched_username) continue
            if (user.password == data.password) matched_password = true;
            if (!matched_password) {
                return callback({
                    code: 402, 
                    status: 'INVALID CREDENTIALS',
                    message: 'Invalid password'
                });
            }
            const token = uuid.v4()
            db.query(`UPDATE faculty SET login_token = '${token}' WHERE user_id = '${user.user_id}'`)
            .then(res => {
                if (res.rowCount == 0) {
                    return callback({
                        code: 200, 
                        status: 'OK',
                        data: {
                            login_token: token
                        }
                    });
                } else {
                    return callback({
                        code: 500, 
                        status: 'OK',
                        data: {
                            login_token: token
                        }
                    });
                }
            }).catch(err => {
                console.log(`[${event}] internal error: ${err}`)
                return callback(validations.validateDBUpdateQueryError(err));
            })
            return
        }
        if (!matched_username) {
            return callback({
                code: 401, 
                status: 'INVALID CREDENTIALS',
                message: 'Invalid username'
            });
        }
    }).catch(err => {
        console.log(`[${event}] internal error: ${err}`)
        callback(validations.validateDBInsertQueryError(err));
    })
}

function resetPassword(data, callback) {

}

module.exports = {
    login,
    resetPassword,
    Login
}
