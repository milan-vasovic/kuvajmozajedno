exports.getGyms = (req, res, next) => {
    try {
        return res.render('fitness/gyms/gyms', {
            path: '/gyms',
            pageTitle: "Teretane"
        });
    } catch (err) {
        const error = new Error("Error: " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getGymById = (req, res, next) => {

}
