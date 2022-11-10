const events = require('./events')
const login = require('./login')

class Endpoint {
    constructor(call_example, response_example, is_authorized, permission_level, listener_function) {
        this.call_example = call_example;
        this.response_example = response_example;
        this.is_authorized = is_authorized;
        this.permission_level = permission_level;
        this.listener_function = listener_function;
    }
}
class ListenerEndpoint {
    constructor(description, listen_example, response_example) {
        this.description = description;
        this.listen_example = listen_example;
        this.response_example = response_example;
    }
}

const endpoints = {
    events: {
        fetch: new Endpoint(
            `socket.emit("events/fetch", {}, (res) => print(res))`,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            events.eventsFetch
        ),
        create: new Endpoint(
            `socket.emit("events/create", <pre><code>${JSON.stringify({user_id: "caa1534e-da15-41b6-8110-cc3fcffb14ed",title: "some event title",body: "some event body",expiry_timestamp: 1665774803},null,4)}</code></pre>, (res) => print(res))`,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: 'added record to db'},null,4)}</code></pre>`,
            true,
            [100],
            events.eventsCreate
        ),
        update: new Endpoint(
            `socket.emit("events/update", <pre><code>${JSON.stringify({event_id: "6af9c7cc-9a71-4847-8794-fef3a0ca9b42",title: "some new event title",body: "some new event body"},null,4)}</code></pre>, (res) => print(res))`,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated event caa1534e-da15-41b6-8110-cc3fcffb14ed record in db`},null,4)}</code></pre>`,
            true,
            [100],
            events.eventsUpdate
        ),
        delete: new Endpoint(
            `socket.emit("events/delete", <pre><code>${JSON.stringify({event_id: "6af9c7cc-9a71-4847-8794-fef3a0ca9b42"},null,4)}</code></pre>, (res) => print(res))`,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted event caa1534e-da15-41b6-8110-cc3fcffb14ed record from db`},null,4)}</code></pre>`,
            true,
            [100],
            events.eventsDelete
        )
    },
    login: {
        auth: new Endpoint(
            `socket.emit("login/auth", <pre><code>${JSON.stringify({username: "test",password: "123"},null,4)}</code></pre>, (res) => print(res))`,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: '${record_schema}'},null,4)}</code></pre>`,
            false,
            ['ALL'],
            login.loginAuth
        ),
        resetPassword: new Endpoint(
            `socket.emit("login/resetPassword", <pre><code>${JSON.stringify({username: "test", old_password: "123", new_password: "456"},null,4)}</code></pre>, (res) => print(res))`,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: 'password reset successful'},null,4)}</code></pre>`,
            false,
            ['ALL'],
            login.resetPassword
        ),
    }
}

const listener_endpoints = {
    events: {
        listener: {
            insert: new ListenerEndpoint(
                'Triggered after a new record is inserted in the table',
                `socket.on("events/listener/insert", (data) => print(data))`,
                `<pre><code>${JSON.stringify({code: 200, status: 'OK', trigger: 'events_insert', data: "${record_schema}"},null,4)}</code></pre>`
            ),
            update: new ListenerEndpoint(
                'Triggered after a record is updated in the table',
                `socket.on("events/listener/update", (data) => print(data))`,
                `<pre><code>${JSON.stringify({code: 200, status: 'OK', trigger: 'events_update', data: ["${record_schema}","${record_schema}"]},null,4)}</code></pre>`
            ),
            delete: new ListenerEndpoint(
                'Triggered after a record is deleted from the table',
                `socket.on("events/listener/delete", (data) => print(data))`,
                `<pre><code>${JSON.stringify({code: 200, status: 'OK', trigger: 'events_delete', data: "${record_schema}"},null,4)}</code></pre>`
            )
        }
    }
}

const endpointsClasses = [
    {
        id: 'events',
        class1: new events.Events(),
        class2: endpoints.events,
        class3: listener_endpoints.events
    },
    {
        id: 'login',
        class1: new login.Login(),
        class2: endpoints.login,
    }
]

function getEndpoints() {
    var string = ''

    string += endpointsClasses.map(e => `<a style="font-size: 22px;" href="#${e.id}">${e.id}</a>`).join('<br>')

    for (const endpoint of endpointsClasses) {
        string += processWebPage(endpoint)
    }
    
    string = string.replace(/<h1>/g,'<h1 style="color: #30bf64">')
    string = string.replace(/<h3>/g,'<h3 style="color: #3269c2">')
    string = string.replace(/<table>/g,'<table style="border: 2px solid black">')
    string = string.replace(/<th>/g,'<th style="border: 1px solid black;border-collapse: collapse;padding: 15px;">')
    string = string.replace(/<td>/g,'<td style="border: 1px solid black;border-collapse: collapse;padding: 15px;">')

    return string
}

function processWebPage(classes) {
    const id = classes.id
    const class1 = classes.class1
    const class2 = classes.class2
    const class3 = classes.class3
    var string = ''

    string += `<center><h1 id="${id}">${class1.name}</h1></center>`

    string += `<h3>Description</h3>`
    string += `<p style="font-size:20px">${class1.description}</p>`

    string += `<h3>Record Schema</h3>`
    var schema = {}
    for (const key in class1.data_types) {
        const field = class1.data_types[key]
        if (field.attribute) {
            schema[key] = field.type
        }
    }
    string += `<p style="font-size:20px"><pre><code>${JSON.stringify(schema, null, 4)}</code></pre></p>`

    string += `<h3>Schema detail</h3>`
    string += `<table><tr><th>Key</th><th>Data type</th><th>Example value</th></tr>`
    for (const key in class1.data_types) {
        const field = class1.data_types[key]
        if (field.required || field.optional) {
            string += `<tr>
                <td>${key}</td>
                <td>${field.type}</td>
                <td>${field.example_value}</td>
            </tr>`
        }
    }
    string += `</table>`

    string += `<h3>Endpoints</h3>`
    string += `<p>All endpoints response contain code, status and message fields.<br>code 200 means response is good<br>code 400 means there was an error in submitted request<br>code 500 means there was an internal server error</p>`
    string += `<table><tr><th>Endpoint</th><th>Required keys</th><th>Optional keys</th><th>Call example</th><th>Response example</th></tr>`
    
    for (const key in class2) {
        const ep2 = class2[key]
        const event = `${id}/${key}`
        string += `<tr><td>${event}</td>`

        string += `<td>`
        for (const key in class1.data_types) {
            const field = class1.data_types[key]
            if (field.required?.includes(event))
                string += `${key}<br>`
        }
        string += `</td>`
        
        string += `<td>`
        for (const key in class1.data_types) {
            const field = class1.data_types[key]
            if (field.optional?.includes(event))
                string += `${key}<br>`
        }
        string += `</td>`
        string += `<td>${ep2.call_example}</td>`
        string += `<td>${ep2.response_example.replaceAll('${record_schema}',JSON.stringify(schema,null,8))}</td>`
        string += `</tr>`
    }
    string += `</table>`

    if (class3) {
        string += `<h3>Real-time Events</h3>`
        string += `<p>All listeners response contain code, status, trigger and data fields.<br>Usually code should be 200<br>Trigger field contains the name of the listener</p>`
        string += `<table><tr><th>Listener</th><th>Description</th><th>Listen example</th><th>Response example</th></tr>`
        for (const key in class3.listener) {
            const listener = class3.listener[key]
            string += `<tr><td>${id}/listener/${key}</td>`
            string += `<td>${listener.description}</td>`
            string += `<td>${listener.listen_example}</td>`
            string += `<td>${listener.response_example.replaceAll('${record_schema}',JSON.stringify(schema,null,8))}</td>`
            string += `</tr>`
        }
        string += `</table>`
    }
    return string
}

module.exports = {
    endpoints,
    listener_endpoints,
    getEndpoints
}