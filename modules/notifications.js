const db = require("./db");
const { FCMNotify } = require("./firebase/FCM");
const { escapeDBCharacters, convertUpper, msToFullTime } = require("./functions");
const { sendMail } = require("./gmail_client");

db.on('connect', () => {
    db.query(`SELECT * FROM notifications WHERE email_sent = false OR push_notified = false`).then(res => {
        res.rows.forEach(notification => sendNotification(notification))
    }).catch(console.error)
})

researchNotificationsTimer()
function researchNotificationsTimer() {
    console.log('[researchNotificationsTimer] called')
    const months = [3, 6, 9, 12]
    const currentMonth = new Date().getMonth() + 1
    const upcomingMonth = months.find(month => month >= currentMonth)
    const nextCall = new Date(new Date(new Date().setMonth(upcomingMonth - 1)).setDate(1)).setHours(0, 0, 0, 0)
    const currentTime = new Date().getTime()
    const msUntilNextCall = nextCall - currentTime
    if (msUntilNextCall > 0 && msUntilNextCall < 2147483647) {
        console.log('[researchNotificationsTimer] executing in', nextCall - currentTime, 'ms')
        setTimeout(() => {
            console.log('[researchNotificationsTimer] executed')
            db.query(`
                SELECT * FROM students_thesis ST
                JOIN students_batch SB on ST.student_batch_id = SB.student_batch_id
                JOIN batches B ON B.batch_id = SB.batch_id
                WHERE SB.admission_cancelled is false AND SB.degree_completed is false AND ST.grade != 'S' AND ST.grade != 'U';
            `).then(res => {
                res.rows.forEach(row => {
                    createNotification(
                        'Research Reminder',
                        `This is to remind you that you have ${msToFullTime(Number(row.batch_expiration_timestamp) - new Date().getTime())} remaining until completion of your ${convertUpper(row.degree_type)} research`,
                        row.student_id,
                        'user_id'
                    )
                })
            }).catch(console.error)
        }, nextCall - currentTime);
    }
}

function markNotificationAsSent(notification_id, type) {
    db.query(`update notifications set ${type} = true where notification_id = ${notification_id}`).catch(console.error)
}

function sendNotification(notification) {
    console.log('[sendNotification] called')

    if (!notification.email_sent) {
        db.query(`SELECT user_email FROM users WHERE user_id = '${notification.user_id}'`).then(res => {
            const email = res.rows[0]?.user_email
            if (email) {
                sendMail(notification.title, notification.body, email).then(res => {
                    console.log('[sendNotification] Sent notification to', email)
                    markNotificationAsSent(notification.notification_id, 'email_sent')
                }).catch(err => {
                    console.error('[sendNotification] Error sending notification to', email, ':', err.message || err.stack || err)
                })
            } else {
                markNotificationAsSent(notification.notification_id, 'email_sent')
            }
        }).catch(console.error)
    }

    if (!notification.push_notified) {
        FCMNotify({
            title: notification.title,
            body: notification.body,
            user_ids: [notification.user_id]
        }).then(res => {
            markNotificationAsSent(notification.notification_id, 'push_notified')
        }).catch(err => {
            if (err?.code == 4000) {
                markNotificationAsSent(notification.notification_id, 'push_notified')
            } else {
                console.error(err)
            }
        })
    }
}

async function createNotification(title, body, id, id_type) {
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

    if (notification.channel == 'users_insert') {
        createNotification(
            'Account Credentials',
            `Your account credentials for MIS login\n\nUsername: ${payload.username}\nPassword: ${payload.default_password}\n\nIt is strongly recommended to change your password to a secure one after login`,
            payload.user_id,
            'user_id'
        )
    }
    if (notification.channel == 'users_update') {
        if (payload[0].user_email != payload[1].user_email) {
            createNotification(
                'Account Update',
                `Your account email has been updated from ${payload[1].user_email} to ${payload[0].user_email}`,
                payload[0].user_id,
                'user_id'
            )
        }
        if (payload[0].username != payload[1].username) {
            createNotification(
                'Account Update',
                `Your account username has been updated from ${payload[1].username} to ${payload[0].username}`,
                payload[0].user_id,
                'user_id'
            )
        }
        if (payload[0].password != payload[1].password) {
            createNotification(
                'Account Update',
                `Your account password has been updated. If this was not you, please immediately reset your password or notify the administrator`,
                payload[0].user_id,
                'user_id'
            )
        }
    }

    if (notification.channel == 'applications_insert') {
        createNotification(
            'New Application',
            `You've received a new application #${payload.serial}`,
            payload.submitted_to,
            'user_id'
        )
        createNotification(
            'Application Submitted',
            `This is to confirm that your application #${payload.serial} has been submitted to respective authority. Kindly await review`,
            payload.submitted_by,
            'user_id'
        )
    }
    if (notification.channel == 'applications_update') {
        if (payload[0].forwarded_to.length > payload[1].forwarded_to.length) {
            const detail = payload[0].forwarded_to.pop()
            createNotification(
                'New Application',
                `A new application #${payload[0].serial} has been forwarded to you`,
                detail.receiver_id,
                'user_id'
            )
            createNotification(
                'Application Forwarded',
                `This is to confirm that your application #${payload[0].serial} has been forwarded. Kindly await review`,
                detail.sender_id,
                'user_id'
            )
        }
    }
})

module.exports = {
    createNotification
}