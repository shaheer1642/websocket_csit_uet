const {Events} = require('./events')

console.log(new Events().data_types.s_no)

const endpoints = [
    new Events
]

function getEndpoints() {
    var string = ''

    for (const endpoint of endpoints) {
        string += `<center><h1>${endpoint.name}</h1></center>`

        string += `<h3>Description</h3>`
        string += `<p style="font-size:20px">${endpoint.description}</p>`

        string += `<h3>Record Schema</h3>`
        var schema = {}
        for (const key in endpoint.data_types) {
            const field = endpoint.data_types[key]
            //console.log(field)
            if (field.attribute) {
                schema[key] = field.type
            }
        }
        string += `<p style="font-size:20px"><pre><code>${JSON.stringify(schema, null, 4)}</code></pre></p>`

        string += `<h3>Schema detail</h3>`
        string += `<table><tr><th>Key</th><th>Data type</th><th>Example value</th></tr>`
        for (const key in endpoint) {
            if (endpoint[key].required || endpoint[key].optional) {
                string += `<tr>
                    <td>${key}</td>
                    <td>${endpoint[key].type}</td>
                    <td>${endpoint[key].example_value}</td>
                </tr>`
            }
        }
        string += `</table>`

        string += `<h3>Endpoints</h3>`
        string += `<p>All endpoints response contain code, status and message fields.<br>code 200 means response is good<br>code 400 means there was an error in submitted request<br>code 500 means there was an internal server error</p>`
        string += `<table><tr><th>Endpoint</th><th>Required keys</th><th>Optional keys</th><th>Call example (Flutter/Dart)</th></tr>`
        for (const subendpoint in endpoint.subendpoints) {
            //console.log(subendpoint)
            string += `<tr><td>${subendpoint}</td>`

            string += `<td>`
            for (const key in endpoint) {
                //console.log(key)
                if (endpoint[key].required?.includes(subendpoint))
                    string += `${key}<br>`
            }
            string += `</td>`
            
            string += `<td>`
            for (const key in endpoint) {
                //console.log(key)
                if (endpoint[key].optional?.includes(subendpoint))
                    string += `${key}<br>`
            }
            string += `</td>`
            string += `<td>${endpoint.subendpoints[subendpoint].call_example}</td>`
            string += `</tr>`
        }
        string += `</table>`

        string += `<h3>Real-time Events</h3>`
        string += `<p>All listeners response contain code, status, trigger and data fields.<br>Usually code should be 200<br>Trigger field contains the name of the listener</p>`
        string += `<table><tr><th>Listener</th><th>Description</th><th>Listen example (Flutter/Dart)</th></tr>`
        for (const listener in endpoint.listeners) {
            //console.log(listener)
            string += `<tr><td>${listener}</td>`
            string += `<td>${endpoint.listeners[listener].description}</td>`
            string += `<td>${endpoint.listeners[listener].listen_example}</td>`
            string += `</tr>`
        }
        string += `</table>`
    }
    //string += '</center>'
    
    string = string.replace(/<h1>/g,'<h1 style="color: #30bf64">')
    string = string.replace(/<h3>/g,'<h3 style="color: #3269c2">')
    string = string.replace(/<table>/g,'<table style="border: 2px solid black">')
    string = string.replace(/<th>/g,'<th style="border: 1px solid black;border-collapse: collapse;padding: 15px;">')
    string = string.replace(/<td>/g,'<td style="border: 1px solid black;border-collapse: collapse;padding: 15px;">')
    //console.log(string)

    return string
}

module.exports = {
    getEndpoints
}