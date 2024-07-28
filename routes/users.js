const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const passport = require('../modules/passport')
const jwt = require('jsonwebtoken');
const { validateData, isBase64 } = require('../modules/validator');
const { body, query } = require('express-validator');
const { sendMail } = require('../modules/gmail_client');
const { hashPassword } = require('../modules/hashing');
const { uploadFile } = require('../modules/aws/aws');
const { verifyVerificationCode, emailVerificationCode } = require('../modules/email_code_verification');

router.get('/user', passport.authenticate('jwt'), (req, res) => {
    console.log('GET /user')
    const user_type = req.user.user_type
    db.query(`
        ${user_type == 'student' ? `
                SELECT * FROM students S
                JOIN users U ON U.user_id = S.student_id
                WHERE S.student_id = '${req.user.user_id}';
            ` : user_type == 'teacher' ? `
                SELECT * FROM teachers T
                JOIN users U ON U.user_id = T.teacher_id
                WHERE T.teacher_id = '${req.user.user_id}';
            ` : `
                SELECT * FROM users
                WHERE user_id = '${req.user.user_id}';
            `
        }
    `).then((db_res) => {
            if (db_res.rowCount == 1) {
                const user = db_res.rows[0]
                user.user_id = (user.user_id || user.student_id || user.teacher_id);
                user.name = (user.student_name || user.teacher_name || user.user_type)

                delete user.password
                delete user.jwt_token
                return res.send(user)
            } else if (db_res.rowCount == 0) return res.sendStatus(404)
            else return res.status(500).send(`Unexpected DB response. Received ${db_res.rowCount} rows`)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        });
});

router.post('/user/login', (req, res, next) => {
    console.log('/api/login')
    passport.authenticate('local', { session: false }, (err, user) => {
        if (err || !user) {
            console.log('Error:', err)
            return res.status(401).send(err || 'Incorrect email or password');
        }
        const token = jwt.sign({ sub: user.user_id }, process.env.JWT_SECRET);
        // Store the token in the database for session persistence
        db.query('UPDATE users SET jwt_token = ($2) WHERE user_id = ($1)', [user.user_id, token])
            .then((db_res) => res.send({ token }))
            .catch(err => next(err));
    })(req, res, next);
});

router.patch('/user/updateAvatar',
    passport.authenticate('jwt'),
    (req, res, next) => validateData([
        body('avatar').custom(isBase64).withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    async (req, res, next) => {
        const data = { ...req.user, ...req.body }

        const fileUrl = await uploadFile('avatar', data.avatar).catch(console.error)
        if (!fileUrl) return res.status(500).send('Error uploading file')

        db.query(`
            UPDATE users SET avatar = '${fileUrl}' WHERE user_id = '${data.user_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send('Avatar updated')
            else res.sendStatus(404)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
);

router.patch('/user/updateEmail',
    (req, res, next) => validateData([
        body('user_email').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('email_verification_code').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    async (req, res, next) => {
        const data = req.body

        data.user_id = verifyVerificationCode(data.email_verification_code)
        if (!data.user_id) return res.status(400).send('Invalid verification code')

        db.query(`
                UPDATE users SET 
                user_email = '${data.user_email}'
                WHERE user_id = '${data.user_id}';
            `).then(db_res => {
            if (db_res.rowCount == 1) res.send('Email updated')
            else res.status(500).send('Unexpected DB error')
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
);

router.post('/user/sendEmailVerificationCode',
    (req, res, next) => validateData([
        body('user_id').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('user_type').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('user_email').isEmail().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
        body('username').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`).optional(),
    ], req, res, next),
    async (req, res, next) => {
        const data = req.body

        if (data.username) {
            if (!['admin', 'pga'].includes(data.username) && !data.user_type) return res.status(400).send('user_type not provided with the username')
            db.query(`
                SELECT * FROM users WHERE 
                username = '${data.username}'
                ${['admin', 'pga'].includes(data.username) ? '' : `AND user_type = '${data.user_type}'`};
            `).then(db_res => {
                const user = db_res.rows[0]
                if (!user) return res.status(400).send('No user registered with given username and user type')
                emailVerificationCode(user.user_id, user.user_email).then(() => {
                    return res.send('email sent')
                }).catch(err => {
                    return res.status(500).send(err.message || err.detail || JSON.stringify(err))
                })
            }).catch(err => {
                console.error(err)
                return res.status(500).send(err.message || err.detail || JSON.stringify(err))
            })
        } else if (data.user_email && data.user_id) {
            emailVerificationCode(data.user_id, data.user_email).then(() => {
                return res.send('email sent')
            }).catch(err => {
                return res.status(500).send(err.message || err.detail || JSON.stringify(err))
            })
        } else if (data.user_email) {
            db.query(`
                SELECT * FROM users WHERE user_email = '${data.user_email}'
            `).then(db_res => {
                const user = db_res.rows[0]
                if (!user) return res.status(400).send('No user registered with given email')
                emailVerificationCode(user.user_id, user.user_email).then(() => {
                    return res.send('email sent')
                }).catch(err => {
                    return res.status(500).send(err.message || err.detail || JSON.stringify(err))
                })
            }).catch(err => {
                console.error(err)
                return res.status(500).send(err.message || err.detail || JSON.stringify(err))
            })
        } else {
            return res.status(400).send('No username or email provided')
        }
    }
);

router.patch('/user/changePassword',
    passport.authenticate('jwt'),
    (req, res, next) => validateData([
        body('current_password').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('new_password').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body }

        if (data.password !== hashPassword(data.current_password)) return res.status(400).send('Current password is incorrect')

        db.query(`
            UPDATE users SET password = '${hashPassword(data.new_password)}' WHERE user_id = '${data.user_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send('Password updated')
            else res.sendStatus(404)
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/user/resetPassword',
    (req, res, next) => validateData([
        body('email_verification_code').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
        body('new_password').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = req.body

        data.user_id = verifyVerificationCode(data.email_verification_code)
        if (!data.user_id) return res.status(400).send('Invalid verification code')

        db.query(`
            UPDATE users SET password = '${hashPassword(data.new_password)}' WHERE user_id = '${data.user_id}';
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send('Password reset successful')
            else res.status(500).send('Unexpted DB error')
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

router.patch('/user/updateFCMToken',
    passport.authenticate('jwt'),
    (req, res, next) => validateData([
        body('fcm_token').isString().notEmpty().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const data = { ...req.user, ...req.body }

        if (data.fcm_tokens.find(ft => ft.token == data.fcm_token)) return res.status(400).send('FCM token already exists')

        data.fcm_tokens.push({ timestamp: new Date().getTime(), token: data.fcm_token })
        while (data.fcm_tokens.length > 5) data.fcm_tokens.shift()

        db.query(`
            UPDATE users SET
            fcm_tokens = '${JSON.stringify(data.fcm_tokens)}'
            WHERE user_id = '${data.user_id}'
        `).then(db_res => {
            if (db_res.rowCount == 1) res.send('updated token')
            else res.status(400).send('Unexpected DB error')
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.message || err.detail || JSON.stringify(err))
        })
    }
)

module.exports = router