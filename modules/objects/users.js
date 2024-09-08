const db = require('../db')
const { event_emitter } = require('../event_emitter')
const JSONbig = require('json-bigint');

var users = {}

db.on('connect', () => {
    updateUsers()
})

function updateUsers(user_id) {
    db.query(`SELECT * FROM users ${user_id ? `WHERE user_id = '${user_id}'` : ''}`).then(res => {
        res.rows.forEach(row => {
            users[row.user_id] = row
        })
    }).catch(console.error)
}

function removeUserToken(token) {
}

db.on('notification', (notification) => {
    const payload = JSONbig.parse(notification.payload);

    if (notification.channel == 'users_insert') {
        updateUsers(payload.user_id)
    }
    if (notification.channel == 'users_update') {
        updateUsers(payload[0].user_id)
    }
})

module.exports = {
    users
}