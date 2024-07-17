const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const passport = require('../modules/passport')
const jwt = require('jsonwebtoken');
const { validateData } = require('../modules/validator');
const { body, query } = require('express-validator');
const { sendMail } = require('../modules/gmail_client');
const { hashPassword } = require('../modules/hashing');

router.get('/users', passport.authenticate('jwt'), (req, res) => {
    db.query(`
        SELECT * FROM users WHERE user_type NOT IN ('student','teacher');
        SELECT * FROM students;
        SELECT * FROM teachers;
    `).then(db_res => {
        const users_list = []

        db_res[0].rows.concat(db_res[1].rows.concat(db_res[2].rows)).forEach(user => {
            users_list.push({
                user_id: user.user_id || user.student_id || user.teacher_id,
                name: user.student_name || user.teacher_name || user.user_type,
            })
        })

        return res.send(users_list)
    }).catch(err => {
        console.error(err)
        res.status(500).send(err.message || err.detail || JSON.stringify(err))
    })
});

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
                user.user_id = user.user_id || user.student_id || user.teacher_id
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
            .then((db_res) => res.send({ token })).catch(err => next(err));
    })(req, res, next);
});

// router.post('/user/changePassword',
//     passport.authenticate('jwt'),
//     (req, res, next) => validateData([
//         body('old_password').isString().withMessage('Password is required'),
//         body('password').isString().withMessage('Password is required'),
//     ], req, res, next),
//     (req, res) => {
//         const user = req.user
//         const body = req.body

//         if (hashPassword(body.old_password) != user.password) return res.status(400).send('Old password is incorrect')

//         db.query(`
//             UPDATE users SET password = ($2) WHERE user_id = ($1)
//         `, [user.user_id, hashPassword(body.password)]).then(db_res => {
//             if (db_res.rowCount == 1) res.send("Password changed successfully")
//             else if (db_res.rowCount == 0) res.sendStatus(404)
//             else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
//         }).catch(err => {
//             console.error(err)
//             res.status(500).send(err.message || err.detail || JSON.stringify(err))
//         })
//     }
// )


// router.post('/user/resetPassword',
//     (req, res, next) => validateData([
//         body('code').isInt().isLength({ min: 6, max: 6 }).withMessage('Invalid code'),
//         body('password').isString().withMessage('Password is required'),
//     ], req, res, next),
//     (req, res) => {
//         const { code, password } = req.body

//         const user = emailOTPs.find(o => o.code == code)
//         if (!user) return res.status(400).send('Invalid OTP code. Please try again')
//         const user_id = user.user_id

//         db.query(`
//             UPDATE users SET password = ($2) WHERE user_id = ($1)
//         `, [user_id, hashPassword(password)]).then(db_res => {
//             if (db_res.rowCount == 1) res.send("Password reset successfully")
//             else if (db_res.rowCount == 0) res.sendStatus(404)
//             else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
//         }).catch(err => {
//             console.error(err)
//             res.status(500).send(err.message || err.detail || JSON.stringify(err))
//         })
//     }
// )

// var emailOTPs = []
// router.post('/user/emailOTP',
//     (req, res, next) => validateData([
//         body('email').isEmail().withMessage('Email is required'),
//     ], req, res, next),
//     (req, res) => {
//         const email = req.body.email?.toLowerCase()

//         db.query(`SELECT * FROM users WHERE LOWER(email) = '${email}'`)
//             .then(db_res => {
//                 if (db_res.rowCount == 1) {
//                     const { user_id } = db_res.rows[0]
//                     const code = Math.floor(Math.random() * 900000) + 100000
//                     emailOTPs.push({ code, email, user_id })
//                     setTimeout(() => { emailOTPs = emailOTPs.filter(o => o.code != code) }, 600000);
//                     sendMail({
//                         to: email,
//                         title: 'Reset Password Request',
//                         body: `We have received a request for resetting your account password\n\nYour verification code is ${code}\nThis code will expire in the next 10 minutes\n\nIf this was not you, please ignore this email`
//                     }).then(() => {
//                         res.send('Verification code has been sent to your email')
//                     }).catch(err => {
//                         console.error(err)
//                         res.status(500).send('Error sending email: ' + err.message || err)
//                     })
//                 } else if (db_res.rowCount == 0) res.status(404).send('That email does not exist')
//                 else res.status(500).send(`Unexpected DB response. Updated ${db_res.rowCount} rows`)
//             }).catch(err => {
//                 console.error(err)
//                 res.status(500).send(err.message || err.detail || JSON.stringify(err))
//             })
//     }
// );

// router.get('/user/emailOTP/verify',
//     (req, res, next) => validateData([
//         query('code').isInt().isLength({ min: 6, max: 6 }).withMessage('Invalid code'),
//     ], req, res, next),
//     (req, res) => {
//         console.log(emailOTPs)
//         const { code } = req.query
//         if (!emailOTPs.find(o => o.code == code))
//             return res.status(400).send('Invalid code')
//         else
//             return res.send('Code is valid')
//     }
// );

module.exports = router