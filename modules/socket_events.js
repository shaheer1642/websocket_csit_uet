const db = require("./db");
const ioEmitter = require("./io_emitter");

const tables = [
    'applications',
    'applications_templates',
    'batches',
    'courses',
    'documents',
    'events',
    'notifications',
    'semesters_courses',
    'semesters',
    'students_batch',
    'students_courses',
    'students_thesis',
    'students',
    'teachers',
    'users',
]

db.on('connect', () => {
    db.query(`
        ${tables.map(t =>
        `
            LISTEN ${t}_insert;
            LISTEN ${t}_update;
            LISTEN ${t}_delete;
        `
    ).join('\n')
        }
    `).catch(console.error)
})

db.on('reconnect', () => {
    db.query(`
        ${tables.map(t =>
        `
            LISTEN ${t}_insert;
            LISTEN ${t}_update;
            LISTEN ${t}_delete;
        `).join('\n')}
    `).catch(console.error)
})

db.on('notification', (notification) => {
    const channel = notification.channel
    const payload = JSON.parse(notification.payload)

    console.log('[DB Notification]', channel)

    tables.forEach(t => {
        if ([`${t}_insert`, `${t}_update`, `${t}_delete`].includes(channel)) {
            ioEmitter.emit('notifyAll', {
                name: `${t}_changed`,
                data: {
                    change_type: channel,
                    ...(payload[0] || payload)
                }
            })
        }
    })
})
