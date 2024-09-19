const { generateToken } = require('csrf-csrf');

// Custom CSRF middleware
function customCsrfMiddleware(req, res, next) {
    const csrfToken = generateToken(req, res, true);
    res.locals.csrfToken = csrfToken;
    next();
}

module.exports = customCsrfMiddleware;
