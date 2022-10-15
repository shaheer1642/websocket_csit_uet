const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const {db} = require('./modules/db_connection')
const axios = require('axios')
const uuid = require('uuid');
const db_modules = require('./modules/db_modules')
const events = require('./modules/endpoints/events')

app.get('/', (req, res) => {
  res.send('<center><h1>Websocket for MIS developed for CSIT Dept. of UET as the Final Year Project</h1></center>');
});

const clients = {}

io.on('connection', (socket) => {
    console.log('a user connected',socket.id);
    clients[socket.id] = socket
    console.log('connected clients',new Date(),Object.keys(clients).length)
    //if (!socket.handshake.query.session_key)
    //  return

    // check if user was previously logged in
    setTimeout(() => {
      checkUserLogin(socket.handshake.query.session_key)
    }, 500);

    // ------------- events -------------
    socket.addListener('events/create',events.eventsCreate)
    socket.addListener('events/fetch',events.eventsFetch)

    socket.addListener('testMsg', (data,callback) => {
      console.log('[testMsg] called')
      console.log('[testMsg] data received:',data)
      callback({code: 200, status: 'OK', data: data})
    })

    socket.on('disconnect', () => {
      console.log('a user disconnected');
      delete clients[socket.id]
      console.log('connected clients',new Date(),Object.keys(clients).length)
      socket.removeAllListeners()
    });
});

function checkUserLogin(session_key) {
  return
  db.query(`select * from hubapp_users WHERE session_key = '${session_key}'`).then(res => {
    if (res.rowCount == 1) {
      // find the socket which has the session_key
      for (const socket in clients) {
        if (clients[socket].handshake.query.session_key == session_key) {
          console.log('a user logged in, emitting login event')
          clients[socket].emit('hubapp/discordLoginAuthorized', {
            code: 200,
            response: res.rows[0]
          })
        }
      }
    }
  }).catch(console.error)
}

db.on('notification', (notification) => {
  console.log('db notification')
  console.log(notification.payload)
  console.log(notification.channel)
})

server.listen(process.env.PORT, () => {
  console.log('Server is listening to port',process.env.PORT);
});