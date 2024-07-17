const { validationResult } = require('express-validator');

/**
 * Middleware for data validation.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The next middleware function.
 * @returns {void}
 */
const validateData = (rules, req, res, next) => {
    console.log(`[${req.method}: ${req.path}]`)

    // Run validation rules and gather validation errors
    Promise.all(rules.map(rule => rule.run(req))).then(() => {
        const errors = validationResult(req);

        // If there are validation errors, respond with a 400 Bad Request status and error messages
        if (errors.isEmpty()) {
            next();
        } else {
            console.log(errors.array())
            return res.status(400).send(errors.array().map(err => err.msg == 'Invalid value' ? `${err.msg} for field ${err.path}` : err.msg).join('; '));
        }

        // If validation passes, proceed to the next middleware or route handler
    });

};

const isURL = (value) => {
    const urlRegex = /^(ftp|http|https):\/\/[^ "]+$/;

    if (urlRegex.test(value))
        return true

    return false
}

const isBase64 = (value) => {
    const base64Regex = /^(data:image\/[a-zA-Z]+;base64,){1}[^\s]+$/;

    if (base64Regex.test(value))
        return true

    return false
}

const isBase64OrURL = (value) => {
    if (Array.isArray(value)) {
        if (value.every(v => isBase64(value) || isURL(value))) {
            return true
        }
    } else {
        if (isBase64(value) || isURL(value)) {
            return true;
        }
    }

    return false
};

module.exports = {
    validateData,
    isURL,
    isBase64,
    isBase64OrURL
};