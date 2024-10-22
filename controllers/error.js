exports.get404 = (req, res, next) => {
    res.status(404).render('errors/404', {
        pageTitle: "Page Not Found",
        pageDescription: "",
        pageKeyWords: "",
        path: "/404",
        isAuthenticated: req.session.isLoggedIn,
    });
};

exports.get500 = (req, res, next) => {
    res.status(500).render('errors/500', {
        pageTitle: "Error!",
        pageDescription: "",
        pageKeyWords: "",
        path: "/500",
        errorMsg: error,
        isAuthenticated: req.session.isLoggedIn
    });
};