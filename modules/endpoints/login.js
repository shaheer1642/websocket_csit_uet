const {db} = require('../db_connection');
const uuid = require('uuid');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes')

class Login {
    name = 'Login';
    description = 'Endpoints for user login'
    data_types = {
        s_no: new DataTypes(true).autonumber,
        user_id: new DataTypes(true).uuid,
        username: new DataTypes(true,['login/auth','login/resetPassword']).string,
        password: new DataTypes(true,['login/auth']).string,
        old_password: new DataTypes(false,['login/resetPassword']).string,
        new_password: new DataTypes(false,['login/resetPassword']).string,
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
            if (res.rowCount == 0) return callback({ code: 402, status: 'INVALID CREDENTIALS', message: 'Username or password does not exist' });
            else if (res.rowCount == 1) return callback({ code: 200, status: 'OK', data: res.rows[0] });
            else return callback({ code: 500, status: 'INTERNAL ERROR', message: `${res[0].rowCount} rows received while updating record` });
            // const users = res.rows
            // var matched_username = false
            // var matched_password = false
            // var matched_user_type = false
            // for (const user of users) {
            //     if (user.username.toLowerCase() == data.username.toLowerCase()) matched_username = true;
            //     if (!matched_username) continue
            //     if (user.password == data.password) matched_password = true;
            //     if (!matched_password) return callback({ code: 402, status: 'INVALID CREDENTIALS', message: 'Invalid password' });
            //     if (!['admin','pga'].data.username.toLowerCase()) {
            //         if (!data.user_type) return callback({ code: 403, status: 'INVALID USER TYPE', message: 'User type not found' });
            //         if ()
            //     }
            //     db.query(`
            //         SELECT * FROM users WHERE user_id = '${user.user_id}';
            //     `)
            //     .then(res => {
            //         if (res[0].rowCount == 1) {
            //             const userObj = res[1].rows[0]
                        
            //         } else {
                        
            //         }
            //     }).catch(err => {
            //         console.log(`[${data.event}] internal error: ${err}`)
            //         return callback(validations.validateDBUpdateQueryError(err));
            //     })
            //     return
            // }
            // if (!matched_username) {
            //     return callback({
            //         code: 401, 
            //         status: 'INVALID CREDENTIALS',
            //         message: 'Invalid username'
            //     });
            // }
        }).catch(err => {
            console.log(`[${data.event}] internal error: ${err}`)
            callback(validations.validateDBUpdateQueryError(err));
        })
    }).catch((err) => callback(validations.validateDBSelectQueryError(err)))
}

function resetPassword(data, callback) {
    console.log(`[${data.event}] called, data received: `, data)
    const validator = validations.validateRequestData(data,new Login,data.event)
    if (!validator.valid) {
        callback({
            code: 400, 
            status: 'BAD REQUEST',
            message: validator.reason
        });
        return
    }
    db.query(`SELECT * FROM users`)
    .then(res => {
        const users = res.rows
        var matched_username = false
        var matched_password = false
        for (const user of users) {
            if (user.username.toLowerCase() == data.username.toLowerCase()) matched_username = true;
            if (!matched_username) continue
            if (user.password == data.old_password) matched_password = true;
            if (!matched_password) {
                return callback({
                    code: 402, 
                    status: 'INVALID CREDENTIALS',
                    message: 'Invalid password'
                });
            }
            if (data.old_password == data.new_password) {
                return callback({
                    code: 403, 
                    status: 'BAD REQUEST',
                    message: 'old and new password cannot be the same'
                });
            }
            db.query(`
                UPDATE users SET password = '${data.new_password}' WHERE user_id = '${user.user_id}';
            `).then(res => {
                if (res.rowCount == 1) {
                    return callback({
                        code: 200, 
                        status: 'OK',
                        message: 'password reset successful'
                    });
                } else {
                    return callback({
                        code: 500, 
                        status: 'INTERNAL ERROR',
                        message: `${res.rowCount} rows received while updating record`
                    });
                }
            }).catch(err => {
                console.log(`[${data.event}] internal error: ${err}`)
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
        console.log(`[${data.event}] internal error: ${err}`)
        callback(validations.validateDBInsertQueryError(err));
    })
}

module.exports = {
    loginAuth,
    resetPassword,
    Login
}
