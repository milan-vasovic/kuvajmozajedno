module.exports = (req, res, next) => {
    if (req.session.user.role != "system") {
        return res.redirect('/prijava');
    }
    next();
}