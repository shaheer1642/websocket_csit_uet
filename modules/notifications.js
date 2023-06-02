const { db } = require("./db_connection");
const { FCMNotify } = require("./firebase/FCM");
const { escapeDBCharacters } = require("./functions");
const { sendMail } = require("./gmail_client");
const { users } = require("./objects/users");

function sendNotification(notification) {
    console.log('[sendEmailNotification] called')

    const email = users[notification.user_id]?.user_email
    if (email) {
        sendMail(notification.title,notification.body,email).then(res => {
            console.log('[sendEmailNotification] Sent notification to',email)
        }).catch(err => {
            console.error('[sendEmailNotification] Error sending notification to',email,':', err.message || err.stack || err)
        })
    }

    FCMNotify({
        title: notification.title,
        body: notification.body,
        user_ids: [notification.user_id]
    })
}

async function createNotification(title,body,id,id_type) {
    var user_id;
    if (id_type != 'user_id') {
        const res = await db.query(`SELECT * FROM students_batch SB JOIN users ON SB.student_id = users.user_id WHERE SB.student_batch_id = '${id}'`).catch(console.error)
        user_id = res?.rows?.[0]?.user_id
    } else {
        user_id = id
    }
    if (!user_id) return
    db.query(`INSERT INTO notifications (title,body,user_id) VALUES ('${escapeDBCharacters(title)}','${escapeDBCharacters(body)}','${user_id}')`).catch(console.error)
}

db.on('notification', (notification) => {
    const payload = JSON.parse(notification.payload);
    
    if (notification.channel == 'notifications_insert') {
        sendNotification(payload)
    }
    
    if (notification.channel == 'students_courses_update') {
        if (payload.grade != payload.old_grade) {
            db.query(`
                SELECT * FROM semesters_courses SC
                JOIN courses C ON SC.course_id = C.course_id
                WHERE SC.sem_course_id = '${payload.sem_course_id}'
            `).then(res => {
                if (res.rowCount != 1) return
                createNotification(
                    'Grade Assignment',
                    `You've been assigned grade ${payload.grade} in the course ${res.rows[0].course_name}`,
                    payload.student_batch_id,
                    'student_batch_id'
                )
            })
        }
    }

    if (notification.channel == 'students_batch_update') {
        if (payload[0].semester_frozen != payload[1].semester_frozen) {
            createNotification(
                'Semester Freeze',
                `Your semester has been ${payload[0].semester_frozen ? 'frozen' : 'unfrozen'}`,
                payload[0].student_batch_id,
                'student_batch_id'
            )
        }
    }
})

module.exports = {
    createNotification
}