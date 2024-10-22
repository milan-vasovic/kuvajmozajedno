exports.getHome = (req, res, next) => {
    try {
        res.render('fitness/default/default', {
            path: '/fitness-family',
            pageTitle: "Pocetna"
        })
    } catch (err) {
        const error = new Error("Error: " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
}