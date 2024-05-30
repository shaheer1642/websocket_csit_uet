const { Client, Pool } = require('pg');

const config = {
    connectionString: process.env.DATABASE_URL,
    keepAlive: true
};

const initClient = new Client(config)
const publicPool = new Pool({ connectionString: process.env.DATABASE_PUBLIC_URL })

// ping DB
publicPool.query(`SELECT * FROM users LIMIT 1`).catch(console.error)

// keep DB awake. ping every 15 minutes
setInterval(() => {
    publicPool.query(`SELECT * FROM users LIMIT 1`).catch(console.error)
}, 900000);


const db = {
    client: initClient,
    query: (queryText, values, callback) => {
        return initClient.query(queryText, values, callback)
    },
    listeners: {
        connect: [],
        reconnect: [],
        notification: [],
    },
};

async function connectToDB() {
    attachListeners(db.client);

    try {
        await db.client.connect();
        console.log('Connected to the database');
        emitEvent('connect');
    } catch (err) {
        console.error('Connection error:', err);

        // Attempt to reconnect after a delay
        await reconnectToDB().then(() => {
            emitEvent('connect')
        }).catch(console.error);
    }
}

async function reconnectToDB() {
    console.log('Attempting to reconnect to the database...');

    // ping DB
    await publicPool.query(`SELECT * FROM users LIMIT 1`).catch(console.error)

    // Delay before attempting to reconnect
    await new Promise((resolve) => setTimeout(resolve, 5000));

    removeExistingListeners(db.client);

    // Create a new client and attempt to connect
    db.client = new Client(config);
    db.query = (queryText, values, callback) => {
        return db.client.query(queryText, values, callback)
    }

    attachListeners(db.client);

    try {
        await db.client.connect();
        console.log('Reconnected to the database');
    } catch (err) {
        console.error('Reconnection attempt failed:', err);

        // Attempt to reconnect again after a delay
        await reconnectToDB();
    }
}

function attachListeners(client) {
    client.on('error', async (err) => {
        console.error('Database error:', err);
        await reconnectToDB().then(() => {
            emitEvent('reconnect')
        }).catch(console.error);
    });

    client.on('notification', (msg) => {
        emitEvent('notification', msg);
    });
}

function removeExistingListeners(client) {
    client.removeAllListeners();
}

function emitEvent(event, ...args) {
    if (db.listeners[event]) {
        db.listeners[event].forEach((listener) => listener(...args));
    }
}

db.on = (event, listener) => {
    if (!db.listeners[event]) {
        db.listeners[event] = [];
    }
    db.listeners[event].push(listener);
};

// Initialize the first connection
connectToDB();

module.exports = { db };