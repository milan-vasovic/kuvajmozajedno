const authController = require("../controllers/auth")
module.exports = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.redirect(`/prijava?redirectTo=${encodeURIComponent(req.originalUrl)}`);
    }

    if (req.session.user.status && !req.session.user.status.find(status => status === "active")) {
        return authController.postLogout(req, res, next);
    }
    next();
}