const express = require('express');
const cors = require('cors')
const bodyParser = require('body-parser')
const http = require('http')
const passport = require('./modules/passport');
const session = require('express-session');
const memoryStore = require('memorystore')(session)
const socketIo = require("socket.io");
const ioEmitter = require('./modules/io_emitter');
const path = require('path');
const { readdirSync } = require('fs');
const { getEndpoints } = require('./modules/endpoints/endpoints');
const { swaggerUi, swaggerSpec } = require('./modules/swagger');
require('./modules/socket_events')
require('./modules/gmail_client')
require('aws-sdk/lib/maintenance_mode_message').suppress = true;
// require('./modules/email_notifications')
// require('./modules/scheduled_db_queries')

const app = express();  // express initialize
const server = http.createServer(app);  // server initialize
const PORT = process.env.PORT || 4000;
const io = new socketIo.Server(server);  // websocket initialize

app.use(cors())
app.use(bodyParser.json({ limit: '20mb' }))
app.use(bodyParser.urlencoded({ extended: true }))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
    store: new memoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
    }),
}));
app.use(passport.initialize());
app.use(passport.session());

readdirSync('routes').forEach(file => app.use('/api', require(`./routes/${file}`)))

app.get('/deprecated-endpoints', (req, res) => {
    res.send(getEndpoints());
});

// app.use('/api', require('./routes/users'))
// app.use('/api', require('./routes/applications'))
// app.use('/api', require('./routes/applicationsTemplates'))
// app.use('/api', require('./routes/customers'))
// app.use('/api', require('./routes/managers'))
// app.use('/api', require('./routes/destinations'))
// app.use('/api', require('./routes/hotels'))
// app.use('/api', require('./routes/rooms'))
// app.use('/api', require('./routes/amenities'))
// app.use('/api', require('./routes/icons'))
// app.use('/api', require('./routes/reviews'))
// app.use('/api', require('./routes/testimonials'))
// app.use('/api', require('./routes/favorites'))
// app.use('/api', require('./routes/reservations'))
// app.use('/api', require('./routes/achievements'))
// app.use('/api', require('./routes/messages'))
// app.use('/api', require('./routes/global_variables'))
// app.use('/api', require('./routes/contact_messages'))
// app.use('/api', require('./routes/faqs'))
// app.use('/api', require('./routes/news'))
// app.use('/api', require('./routes/news_comments'))
// app.use('/api', require('./routes/news_categories'))

app.use(express.static(path.join(__dirname, 'front_end', 'dist')))

app.get("*", (req, res) => {
    console.log('sending index.html', req.path);
    // res.send('<h3>The website is currently under maintenance. For any query, please contact +92 348 8947255</h3>')
    res.sendFile(path.join(__dirname, 'front_end', 'dist', 'index.html'))
});

server.listen(PORT, (error) => {
    if (!error) console.log("Server is Successfully Running, and App is listening on port " + PORT)
    else console.log("Error occurred, server can't start", error);
});

io.on('connection', (socket) => {
    console.log('[websocket] connected clients', io.sockets.sockets.size)
});

ioEmitter.on('notifyAll', event => {
    console.log('notifyAll', event)
    io.emit(event.name, event.data)
})

// restart server every 24.5 hours
setTimeout(() => {
    process.exit()
}, 88200000);

// const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;

// setInterval(() => {
//     const memoryData = process.memoryUsage();

//     const memoryUsage = {
//         rss: `${formatMemoryUsage(memoryData.rss)} -> Resident Set Size - total memory allocated for the process execution`,
//         heapTotal: `${formatMemoryUsage(memoryData.heapTotal)} -> total size of the allocated heap`,
//         heapUsed: `${formatMemoryUsage(memoryData.heapUsed)} -> actual memory used during the execution`,
//         external: `${formatMemoryUsage(memoryData.external)} -> V8 external memory`,
//     };

//     console.log(memoryUsage);
// }, 180000);