const db = require("./db");
const { sendMail } = require("./gmail_client");


const email_body =
    `<p>Greetings

This email is about requesting some important information regarding your MS and/or PhD program in University of Engineering & Technology, Peshawar. This information is to be included in the Managment Information System application that is being developed for the postgraduate MS & PhD programs in CSIT UET. The system development has been undertaken as the bachelors final year project by me, REDACTED, and my team members REDACTED and REDACTED (REDACTED Semester CSIT Dept.) which is under supervision of REDACTED.

For data migration purposes, we require some missing information from all the previously enrolled students. Please reply to this email with the following information that we require:

<b>- Registration Number (MS and/or PhD)</b>
<b>- CNIC</b>
<b>- Attach transcript file if available (MS and/or PhD)</b>

<b>To submit the requested information, please reply to this email</b>
For any queries, you may contact REDACTED

Once your account has been registered, you will receive account credentials through email which you can use to log into the website

You are receiving this email on behalf of REDACTED, REDACTED, and Chairman CSIT UET

Regards<p>`.replace(/\n/g, '<br>');


// db.on('connected', () => {
//     insertEmails()
// })

// setTimeout(() => {
//     sendEmails()
// }, 2000);

async function sendEmails() {
    console.log('sendEmails called')
    db.query(`SELECT * FROM contact_users WHERE information_request = false`).then(async res => {
        const emails = res.rows.map(row => row.email)
        console.log('sending email to', emails.length, 'users')
        for (const email of emails) {
            await sendMail(
                'Information Request for MIS Application (UET)',
                email_body,
                email,
                true,
                true
            ).then(res => {
                console.log('Sent email to', email)
                db.query(`UPDATE contact_users SET information_request = true WHERE email = '${email}'`)
                    .catch((err) => {
                        console.error('Error updating DB for email', email, ':', err.message || err.stack || err)
                    })
            }).catch(err => {
                console.error('Error sending email to', email, ':', err.message || err.stack || err)
            })
        }
    }).catch(err => {
        console.error('Error retreiving emails list:', err.message || err.stack || err)
    })
}

function insertEmails() {
    console.log('insertEmails called')

    const emails = ``

    db.query(`
        ${emails.split('\n').map(email => `INSERT INTO contact_users (email) VALUES ('${email.trim()}');`).join('\n')}
    `).then(res => {
        console.log(res.length, 'rows inserted')
    }).catch(console.error)
}