const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const { db } = require('./modules/db_connection')
// const axios = require('axios')
// const db_modules = require('./modules/db_modules')
const { endpoints, getEndpoints } = require('./modules/endpoints/endpoints')
const { event_emitter } = require('./modules/event_emitter')
const path = require('path')

require('./modules/gmail_client')
// if (process.env.ENVIRONMENT_TYPE == 'prod') 
require('./modules/notifications')
const cors = require('cors')

app.use(cors())
// parse requests of content-type - application/json
app.use(express.json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));


app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error(err);
    console.error(err.body);
    return res.status(400).send({ status: 404, message: err.message }); // Bad request
  }
  next()
})

app.get('/endpoints', (req, res) => {
  res.send(getEndpoints());
});

app.use(express.static(path.join(__dirname, 'build')))

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'))
});

/* Assign API Endpoints */
for (const key in endpoints) {
  const ev1 = key
  const endpoint = endpoints[key]
  for (const key in endpoint) {
    const subendpoint = endpoint[key]
    const event = `/api/${ev1}/${key}`
    // console.log('[Registering api endpoint]',event)
    app.post(event, (req, res) => {
      console.log(req.body)
      const login_token = req.headers?.authorization
      if (subendpoint.is_authorized) {
        if (login_token) {
          authorizeEvent(login_token, subendpoint.permission_level)
            .then(db_res => {
              if (db_res.code == 200) {
                return subendpoint.listener_function({ ...req.body, event: event.replace('/api/', ''), login_token: login_token, user_id: db_res.user_id }, (data) => removeSensitiveInfo(data, (data) => res.send(data)))
              } else {
                return res.send(db_res)
              }
            }).catch(err => {
              return res.send(err)
            })
        } else {
          return res.send({ code: 400, message: 'No authorization token provided.' })
        }
      } else {
        return subendpoint.listener_function({ ...req.body, event: event.replace('/api/', ''), login_token: login_token }, (data) => removeSensitiveInfo(data, (data) => res.send(data)))
      }
    })
  }
}

app.get('/api/', (req, res) => {
  return res.statusCode(400).send({
    code: 400,
    message: 'Invalid endpoint',
  })
});

function removeSensitiveInfo(res, callback) {
  if (res.data) {
    if (Array.isArray(res.data)) {
      res.data = res.data.reduce((data, object) => {
        if (object?.username) delete object.username
        if (object?.password) delete object.password
        if (object?.login_token) delete object.login_token
        if (object?.fcm_tokens) delete object.fcm_tokens
        return [...data, object]
      }, [])
    } else {
      if (res.data.username) delete res.data.username
      if (res.data.password) delete res.data.password
      if (res.data.login_token) delete res.data.login_token
      if (res.data.fcm_tokens) delete res.data.fcm_tokens
    }
  }
  callback(res)
}

const clients = {}

io.on('connection', (socket) => {
  console.log('a user connected', socket.id, socket.handshake.auth);
  if (!socket.handshake.auth.token && !socket.handshake.query.postman) {
    socket.disconnect()
    return
  }
  const login_token = socket.handshake.auth.token
  clients[socket.id] = socket
  console.log('connected clients', new Date(), Object.keys(clients).length)

  for (const key in endpoints) {
    const ev1 = key
    const endpoint = endpoints[key]
    for (const key in endpoint) {
      const subendpoint = endpoint[key]
      const event = `${ev1}/${key}`
      socket.addListener(event, function (data, callback) {
        if (subendpoint.is_authorized && !socket.handshake.query.postman) {
          authorizeEvent(login_token, subendpoint.permission_level)
            .then(res => {
              if (res.code == 200) {
                try {
                  return subendpoint.listener_function({ ...data, event: event, login_token: login_token, user_id: res.user_id }, callback ? (res) => removeSensitiveInfo(res, callback) : () => { })
                } catch (e) {
                  console.log(e)
                  callback ? callback({ code: 500, message: e.stack || e }) : () => { }
                }
              } else {
                if (callback) return callback(res)
              }
            }).catch(err => {
              if (callback) return callback(err)
            })
        } else {
          try {
            return subendpoint.listener_function({ ...data, event: event, login_token: login_token }, callback ? (res) => removeSensitiveInfo(res, callback) : () => { })
          } catch (e) {
            console.log(e)
            callback ? callback({ code: 500, message: e.stack || e }) : () => { }
          }
        }
      })
    }
  }

  socket.addListener("error", function (err, callback) {
    console.log('[socket event error]', err)
  });

  socket.addListener('ping', (data, callback) => {
    console.log('[ping] called data received:', data)
    callback({ code: 200, status: 'OK', data: data })
  })

  socket.on('disconnect', () => {
    console.log('a user disconnected');
    delete clients[socket.id]
    console.log('connected clients', new Date(), Object.keys(clients).length)
    socket.removeAllListeners()
  });
});

function authorizeEvent(login_token, permission_level) {
  return new Promise((resolve, reject) => {
    db.query(`SELECT * FROM users WHERE login_token = '${login_token}'`)
      .then(res => {
        if (res.rowCount == 1) {
          if (permission_level == 'ALL' || permission_level.includes(res.rows[0].user_type))
            return resolve({ code: 200, status: 'OK', user_id: res.rows[0].user_id })
          else
            return resolve({ code: 400, status: 'UNAUTHORIZED', message: 'no permission to access this endpoint' })
        }
        else if (res.rowCount == 0)
          return resolve({ code: 400, status: 'UNAUTHORIZED', message: 'not logged in' })
        else
          return reject({ code: 500, status: 'INTERNAL ERROR', message: `received ${res.rowCount} records when querying db` })
      }).catch(err => {
        console.log('[authorizeEvent] db error', err.stack)
        return reject({ code: 500, status: 'INTERNAL ERROR', message: err.stack })
      })
  })
}

event_emitter.on('notifyAll', (e) => {
  console.log('[io.emit]', e.event)
  io.emit(e.event, e.data)
})


server.listen(process.env.PORT, () => {
  console.log('Server is listening to port', process.env.PORT);
});