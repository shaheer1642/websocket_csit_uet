const DB = require('pg');

const db = new DB.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    keepAlive: true
})

db.connect().then(async res => {
    db.emit('connected')
    console.log('DB Connection established.')

    db.query(`
        LISTEN events_insert;
        LISTEN events_update;
        LISTEN events_delete;

        LISTEN batches_insert;
        LISTEN batches_update;
        LISTEN batches_delete;

        LISTEN users_insert;
        LISTEN users_update;
        LISTEN users_delete;

        LISTEN students_insert;
        LISTEN students_update;
        LISTEN students_delete;

        LISTEN students_batch_insert;
        LISTEN students_batch_update;
        LISTEN students_batch_delete;

        LISTEN teachers_insert;
        LISTEN teachers_update;
        LISTEN teachers_delete;

        LISTEN courses_insert;
        LISTEN courses_update;
        LISTEN courses_delete;

        LISTEN semesters_insert;
        LISTEN semesters_update;
        LISTEN semesters_delete;

        LISTEN semesters_courses_insert;
        LISTEN semesters_courses_update;
        LISTEN semesters_courses_delete;

        LISTEN students_courses_insert;
        LISTEN students_courses_update;
        LISTEN students_courses_delete;

        LISTEN students_thesis_insert;
        LISTEN students_thesis_update;
        LISTEN students_thesis_delete;

        LISTEN documents_insert;
        LISTEN documents_update;
        LISTEN documents_delete;

        LISTEN applications_insert;
        LISTEN applications_update;
        LISTEN applications_delete;

        LISTEN applications_templates_insert;
        LISTEN applications_templates_update;
        LISTEN applications_templates_delete;

        LISTEN notifications_insert;
    `).catch(console.error)
}).catch(err => {
    console.log('DB Connection failure.\n' + err)
});

db.on('error', err => {
    console.log('=============== DB Connection error. ==============')
    console.error(err)
    process.exit()
})

db.on('notification', (notification) => {
    console.log('[DB Notification]',notification.channel)
})

setInterval(() => {
    db.query(`SELECT * FROM events`).then(res => {
        console.log('Pinged the DB. Received rows:',res.rowCount)
    }).catch(console.error)
}, 900000);

db.setMaxListeners(15)

module.exports = {db};