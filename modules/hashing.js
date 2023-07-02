const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(process.env.CRYPTO_SALT + password).digest('hex')
}

module.exports = {
    hashPassword
}