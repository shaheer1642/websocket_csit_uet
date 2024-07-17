const passport = require('passport');
const db = require('./db');
const LocalStrategy = require('passport-local').Strategy;
const JWTStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const { hashPassword } = require('./hashing');

passport.use(
    new LocalStrategy({ passReqToCallback: true }, (req, username, password, done) => {
        db.query(`
            SELECT * FROM users WHERE 
            REPLACE(LOWER(username),'-','') = '${username.toLowerCase()}'
        `).then(res => {
            const user = res.rows[0]
            if (!user) {
                return done('Incorrect username', false);
            }
            if (['student', 'teacher'].includes(user.user_type) && user.user_type != req.body.user_type) {
                return done('Incorrect username', false);
            }
            if (user.password !== hashPassword(password)) {
                return done('Incorrect password.', false);
            }
            return done(null, user);
        }).catch(err => done(err, false));
    })
);

passport.use(
    new JWTStrategy(
        {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.JWT_SECRET
        },
        (payload, done) => {
            db.query(`SELECT * FROM users WHERE user_id = '${payload.sub}'`)
                .then(res => {
                    const user = res.rows[0]
                    if (!user) {
                        return done(null, false);
                    }
                    return done(null, user);
                }).catch(err => done(err));
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.user_id);
});

passport.deserializeUser((user_id, done) => {
    db.query(`SELECT * FROM users WHERE user_id = '${user_id}'`)
        .then(res => done(null, res.rows[0]))
        .catch(err => done(err));
});

const initializeSessions = () => {
    console.log('Initializing Sessions')
    db.query('SELECT * FROM users')
        .then(res => {
            res.rows.forEach(user => {
                if (user.jwt_token) {
                    const req = { user };
                    const res = {};
                    passport.session()(req, res, () => { });

                    // passport.deserializeUser(user.user_id, (err, user) => {
                    //     if (!err && user) {
                    //     }
                    // });
                }
            });
            console.log('Initialized Sessions')
        }).catch(err => console.error('Error initializing sessions:', err));
};

// Initialize sessions when the server starts
db.on('connect', () => {
    initializeSessions()
})

module.exports = passport