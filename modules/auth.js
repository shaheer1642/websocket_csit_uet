module.exports = {
    hasRole(roles, req, res, next) {
        console.log('has role called', roles);
        if (req.isAuthenticated() && roles.includes(req.user.user_type)) {
            return next(); // User is authorized as admin
        } else {
            return res.status(403).send('Unauthorized'); // User is not authorized
        }
    },
};