const { sendMail } = require("./gmail_client")
const { users } = require("./objects/users")

const emailVerificationCodes = {}

function emailVerificationCode(user_id, user_email) {
    return new Promise((resolve, reject) => {
        if (!user_email) user_email = users[user_id].user_email
        if (!user_email) return reject('Could not find email to send verification code')

        const code = generateVerificationCode()
        if (emailVerificationCodes[code]) return reject('Internal error while generating code. Please try again')

        sendMail(
            'Verification Code for MIS',
            `Please enter the code ${code}\nThis code will expire in 5 minutes`,
            user_email
        ).then(res => {
            setVerificationCode(code, user_id)
            resolve()
        }).catch(err => {
            reject(err)
        })
    })
}

function timeoutVerificationCode(code, timeout_duration = 300000) {
    setTimeout(() => {
        delete emailVerificationCodes[code]
    }, timeout_duration);
}

function setVerificationCode(code, user_id) {
    emailVerificationCodes[code] = user_id
    timeoutVerificationCode(code)
}

function verifyVerificationCode(code) {
    if (emailVerificationCodes[code]) {
        timeoutVerificationCode(code, 1)
        return emailVerificationCodes[code]
    } else {
        return null
    }
}

function generateVerificationCode() {
    let ID = "";
    let characters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    for (var i = 0; i < 6; i++) {
        ID += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return ID;
}

module.exports = {
    emailVerificationCode,
    verifyVerificationCode
}