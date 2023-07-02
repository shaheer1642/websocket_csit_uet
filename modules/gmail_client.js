const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const { db } = require('./db_connection');
const MailComposer = require('nodemailer/lib/mail-composer');

// If modifying these scopes, delete gmail_token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose', 'https://www.googleapis.com/auth/gmail.modify'];
// The file gmail_token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'gmail_token.json';

var gmail_client = undefined

authorize(JSON.parse(process.env.GMAIL_CREDENTIAL), (auth) => {
    try {
        gmail_client = google.gmail({ version: 'v1', auth })
    }
    catch (err) {
        return console.error(err)
    }
    console.log('authorized gmail')
    // getEmails()
    // composeEmail()
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    // console.log(credentials)
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client)
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            console.log('refreshed token')
            callback(oAuth2Client);
        });
    });
}

const sendMail = async (title, body, email, exclude_footer, is_html) => {
    if (!gmail_client) throw Error('Could not authorize gmail')

    throw Error('Email service has been temporarily disabled')

    const fileAttachments = [
        {
            filename: 'attachment1.txt',
            content: 'This is a plain text file sent as an attachment',
        },
        {
            filename: 'websites.pdf',
            path: 'https://www.labnol.org/files/cool-websites.pdf',
        },
    ];

    const text_body = `${body.replace(/\\r\\n/g, '\n')}${exclude_footer ? '' : '\n\nThis is an auto-generated email sent via MIS application from CSIT, University of Engineering & Technology, Peshawar'}`

    const options = {
        to: email,
        // cc: 'cc1@example.com, cc2@example.com',
        // replyTo: 'amit@labnol.org',
        subject: title,
        text: is_html ? '' : text_body,
        html: is_html ? text_body : undefined,
        // attachments: fileAttachments,
        textEncoding: 'base64',
        // headers: [
        //   { key: 'X-Application-Developer', value: 'Amit Agarwal' },
        //   { key: 'X-Application-Version', value: 'v1.0.0.2' },
        // ],
    };
    const rawMessage = await createMail(options);
    const { data: { id } = {} } = await gmail_client.users.messages.send({
        userId: 'me',
        resource: {
            raw: rawMessage,
        },
    });
    return id;


    function encodeMessage(message) {
        return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };

    async function createMail(options) {
        const mailComposer = new MailComposer(options);
        const message = await mailComposer.compile().build();
        return encodeMessage(message);
    };
}
module.exports = {
    sendMail,
}