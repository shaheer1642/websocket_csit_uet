const DB = require('pg');

const db = new DB.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    keepAlive: true
})

db.connect().then(async res => {
    console.log('DB Connection established.')

    db.query(`
        LISTEN events_insert;
        LISTEN events_update;
        LISTEN events_delete;

        LISTEN batches_insert;
        LISTEN batches_update;
        LISTEN batches_delete;

        LISTEN students_insert;
        LISTEN students_update;
        LISTEN students_delete;

        LISTEN teachers_insert;
        LISTEN teachers_update;
        LISTEN teachers_delete;

        LISTEN courses_insert;
        LISTEN courses_update;
        LISTEN courses_delete;

        LISTEN semesters_insert;
        LISTEN semesters_update;
        LISTEN semesters_delete;
    `).catch(console.error)
}).catch(err => {
    console.log('DB Connection failure.\n' + err)
});

db.on('error', err => {
    console.log('=============== DB Connection error. ==============')
    console.log(err)
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

module.exports = {db};