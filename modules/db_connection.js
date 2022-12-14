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
    `).catch(console.error)
}).catch(err => {
    console.log('DB Connection failure.\n' + err)
});

db.on('error', err => {
    console.log('=============== DB Connection error. ==============')
    console.log(err)
    process.exit()
})

setInterval(() => {
    db.query(`SELECT * FROM events`).then(res => {
        console.log('Pinged the DB. Received rows:',res.rowCount)
    }).catch(console.error)
}, 1800000);

module.exports = {db};