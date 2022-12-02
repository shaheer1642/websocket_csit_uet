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
const login = require('./modules/endpoints/login')
const {endpoints,listener_endpoints,getEndpoints} = require('./modules/endpoints/endpoints')

app.get('/', (req, res) => {
  res.send('<center><h1>Websocket for MIS developed for CSIT Dept. of UET as the Final Year Project</h1></center>');
});

app.get('/endpoints', (req, res) => {
  res.send(getEndpoints());
});

const clients = {}

io.on('connection', (socket) => {
  console.log('a user connected',socket.id, socket.handshake.auth);
  if (!socket.handshake.auth.token) return
  const login_token = socket.handshake.auth.token
  clients[socket.id] = socket
  console.log('connected clients',new Date(),Object.keys(clients).length)

  for (const key in endpoints) {
    const ev1 = key
    const endpoint = endpoints[key]
    for (const key in endpoint) {
      const subendpoint = endpoint[key]
      const event = `${ev1}/${key}`
      socket.addListener(event, function(data,callback) {
        if (subendpoint.is_authorized) {
          authorizeEvent(login_token,subendpoint.permission_level)
          .then(res => {
            if (res.code == 200) {
              return subendpoint.listener_function({...data, event: event, token: login_token},callback)
            } else {
              if (callback) return callback(res)
            }
          }).catch(err => {
            if (callback) return callback(err)
          })
        } else {
          return subendpoint.listener_function({...data, event: event, token: login_token},callback)
        }
      })
    }
  }

  socket.addListener("error", function (err,callback) {
    console.log('[socket event error]',err)
  });

  socket.addListener('ping', (data,callback) => {
    console.log('[ping] called data received:', data)
    callback({code: 200, status: 'OK', data: data})
  })

  socket.on('disconnect', () => {
    console.log('a user disconnected');
    delete clients[socket.id]
    console.log('connected clients',new Date(),Object.keys(clients).length)
    socket.removeAllListeners()
  });
});

function authorizeEvent(login_token,permission_level) {
  return new Promise((resolve,reject) => {
    db.query(`SELECT * FROM users WHERE login_token = '${login_token}'`)
    .then(res => {
      if (res.rowCount == 1) {
        if (permission_level.includes(res.rows[0].permission_level))
          return resolve({code: 200, status: 'OK'})
        else
          return resolve({code: 400, status: 'UNAUTHORIZED', message: 'no permission to access this endpoint'})
      }
      else if (res.rowCount == 0)
        return resolve({code: 400, status: 'UNAUTHORIZED', message: 'not logged in'})
      else
        return reject({code: 500, status: 'INTERNAL ERROR', message: `received ${res.rowCount} records when querying db`})
    }).catch(err => {
      console.log('[authorizeEvent] db error', err.stack)
      return reject({code: 500, status: 'INTERNAL ERROR', message: err.stack})
    })
  })
}

db.on('notification', (notification) => {
  console.log('db notification')
  console.log(notification.payload)
  console.log(notification.channel)
  const payload = JSON.parse(notification.payload);
  
  if (notification.channel == 'events_insert') {
    for (const socket in clients) {
      clients[socket].emit('events/listener/insert', {
        code: 200, 
        status: 'OK',
        trigger: notification.channel,
        data: payload
      })
    }
  }
  if (notification.channel == 'events_update') {
    for (const socket in clients) {
      clients[socket].emit('events/listener/update', {
        code: 200, 
        status: 'OK',
        trigger: notification.channel,
        data: payload[0]
      })
    }
  }
  if (notification.channel == 'events_delete') {
    for (const socket in clients) {
      clients[socket].emit('events/listener/delete', {
        code: 200, 
        status: 'OK',
        trigger: notification.channel,
        data: payload
      })
    }
  }
})

server.listen(process.env.PORT, () => {
  console.log('Server is listening to port',process.env.PORT);
});