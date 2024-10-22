// Controllers for auth routes and function to the database
const mongoose = require("mongoose");

// Import neccesery things
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer");

// Import Models to be used and passed to template
const User = require("../models/user");

// Setting trasporter
var transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_AUTH_USER,
        pass: process.env.EMAIL_AUTH_PASS,
    },
});


//-------------------------------------- GET Functions ----------------------------------------------

exports.getLogin = (req, res, next) => {
    // Check if there are existingData, if not set to []
    if (res.locals.role !== 'guest') {
        return res.redirect('/novosti');
    }

    const redirectUrl = req.query.redirectTo || '/novosti';

    let existingData = req.existingData;
    if (existingData) {
        existingData = existingData;
    } else {
        existingData = null;
    };

    // Render signup page
    res.render("auth/login", {
        path: "/prijava",
        pageTitle: "Prijava",
        pageDescription: "Prijavite se na našu aplikaciju, postanite član zajednice kuvajmo zajedno, pomozite da sačuvamo i podelimo ukuse, znanje i emocije!",
        pageKeyWords: "prijava, zajednica, tim",
        errorMessage: "",
        existingData,
        redirectTo: redirectUrl
    });
}

exports.getSignup = (req, res, next) => {
    // Check if there are existingData, if not set to []
    let existingData = req.existingData;
    if (existingData) {
        existingData = existingData;
    } else {
        existingData = null;
    };

    // Render signup page
    res.render("auth/signup", {
        path: "/registracija",
        pageTitle: "Registracija",
        pageDescription: "Registrujte se na našu aplikaciju, postanite član zajednice kuvajmo zajedno, pomozite da sačuvamo i podelimo ukuse, priče, emocije",
        pageKeyWords: "registracija, zajednica, član",
        errorMessage: "",
        existingData
    });
}

exports.getConfirmEmail = (req, res, next) => {
    // Get token from request.params.confirmToken
    const confirmToken = req.params.confirmToken;

    try {
        // Check does that token exist in any user and does it expired
        User.findOne({ confirmToken: confirmToken, confirmTokenExpiration :{ $gt: Date.now() } })
        .then(user => {
            if (!user) {
                return res.redirect('/'); 
            }

            // If exist render confirmEmail page with right data
            res.render("auth/confirm-email", {
                path: "/potvrdite-email",
                pageTitle: "Potvrda Emaila",
                pageDescription: "",
                pageKeyWords: "",
                errorMessage: "",
                userId: user._id.toString(),
                confirmToken: confirmToken,
            });
        })
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getResetPassword = (req, res, next) => {
    // Check if there are existingData, if not set to []
    let existingData = req.existingData;
    if (existingData) {
        existingData = existingData;
    } else {
        existingData = null;
    };

    // render resetPassword page
    res.render("auth/reset", {
        path: "/restartujte-sifru",
        pageTitle: "Restartovanje Šifre",
        pageDescription: "",
        pageKeyWords: "",
        errorMessage: "",
        existingData: existingData
    });
}

exports.getNewPasword = (req, res, next) => {
    // Get token from request.params.token
    const token = req.params.token;

    try {
        // Check does that token exist in any user and does it expired
        User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
            .then((user) => {
                // If exist and not expired render newPassword page with right data
                res.render("auth/new-password", {
                    path: "/restartujte-sifru",
                    pageTitle: "Restartovanje Šifre",
                    pageDescription: "",
                    pageKeyWords: "",
                    errorMessage: "",
                    userId: user._id.toString(),
                    passwordToken: token,
                });
            })
            .catch((err) => console.log(err));
        } catch (err) {
            const error = new Error("Desila se nepredviđena greška!");
            error.httpStatusCode = 500;
            return next(error);
        }
}

exports.getEmailSent = (req, res, next) => {
    res.render("auth/email-sent", {
        path: "/poslat-email",
        pageTitle: "Poslat Email!",
        pageDescription: "",
        pageKeyWords: "",
    });
}
// ----------------------------------- POST Functions ---------------------------------------

exports.postLogin = (req, res, next) => {
    // Get data from request.body
    const email = req.body.email;
    const password = req.body.password;
    const redirectUrl = req.body.redirectTo || '/novosti';

    // Check for data validation
    const error = validationResult(req);

    // If not render login page with error and existing data
    if (!error.isEmpty()) {
        return res.status(422).render(
            "auth/login", {
            path: "/prijava",
            pageTitle: "Prijava",
            pageDescription: "",
            pageKeyWords: "",
            errorMessage: error.array()[0].msg,
            existingData: {
                email: email
            },
            redirectTo: redirectUrl
        }
        )
    };

    try {
        // Check if user exist
        User.findOne({ email: email })
            .then(user => {
                if (!user) {
                    return res.status(422).render(
                        "auth/login", {
                        path: "/prijava",
                        pageTitle: "Prijava",
                        pageDescription: "",
                        pageKeyWords: "",
                        errorMessage: "Nema korisnika sa tom email adresom.",
                        existingData: {
                            email: email
                        },
                        redirectTo: redirectUrl
                    }
                    )
                };

                // If exist compare passwords
                bcrypt
                    .compare(password, user.password)
                    .then((doMatch) => {
                        // If yes set session.isLoggedIn to true and session.user to user
                        if (doMatch) {
                            // Check is user confirmed
                            if (user.confirmed != true) {
                                return res.status(422).render(
                                    "auth/login", {
                                    path: "/prijava",
                                    pageTitle: "Prijava",
                                    pageDescription: "",
                                    pageKeyWords: "",
                                    errorMessage: "Korisnik mora da bude potvrđen!",
                                    existingData: {
                                        email: email
                                    },
                                    redirectTo: redirectUrl
                                })
                            }
                            const isActive = user.status.find(status => status === 'active');

                            if (!isActive) {
                                let isSuspended = user.status.find(status => status === 'suspended');
                                let status = isSuspended ? 'suspended' : 'inactive'
                                return res.status(422).render(
                                    "auth/login", {
                                    path: "/prijava",
                                    pageTitle: "Prijava",
                                    pageDescription: "",
                                    pageKeyWords: "",
                                    errorMessage: "Ovaj korisnik je " + status +"! Molimo vas pišite našoj tehničkoj podršci.",
                                    existingData: {
                                        email: email
                                    },
                                    redirectTo: redirectUrl
                                })
                            }

                            // const currentDate = new Date()
                            // user.subscribed.users.forEach(subUser => {
                            //     if (subUser.expirationDate < )
                            // });

                            req.session.isLoggedIn = true;
                            req.session.user = user;
                            
                            user.lastLogin = Date.now();

                            user.save();

                            // Save session to database
                            return req.session.save(() => {
                                // Redirect to /my-feed
                                res.redirect(redirectUrl);
                            });
                        };

                        // If not render login page with error and existing data
                        return res.status(422).render(
                            "auth/login", {
                            path: "/prijava",
                            pageTitle: "Prijava",
                            pageDescription: "",
                            pageKeyWords: "",
                            errorMessage: "Pogrešna Šifra!",
                            existingData: {
                                email: email
                            },
                            redirectTo: redirectUrl
                        }
                        )
                    })
                    .catch((err) => {
                        res.redirect("/prijava");
                    });
            });
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postSignup = async (req, res, next) => {
    try {
        // Get data from request.body
        const { username, email, password } = req.body;
        const defaultImagePath = "/images/default_user.png";
        const userImage = req.files.find(file => file.fieldname === 'images' && !Array.isArray(file));
        const userImageUrl = userImage ? "/images/" + userImage.filename : defaultImagePath;
        const acceptance = req.body.acceptance === "on";

        // Check for data validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).render("auth/signup", {
                path: "/registracija",
                pageTitle: "Registracija",
                pageDescription: "",
                pageKeyWords: "",
                errorMessage: errors.array()[0].msg,
                existingData: { username, email }
            });
        }

        // Check if user exists with that email
        let userWithEmail = await User.findOne({ email });
        if (userWithEmail) {
            return res.status(422).render("auth/signup", {
                path: "/registracija",
                pageTitle: "Registracija",
                pageDescription: "",
                pageKeyWords: "",
                errorMessage: "Ovaj email je već zauzet!!",
                existingData: { username, email }
            });
        }

        // Check if username already exists
        let userWithUsername = await User.findOne({ username });
        if (userWithUsername) {
            return res.status(422).render("auth/signup", {
                path: "/registracija",
                pageTitle: "Registracija",
                pageDescription: "",
                pageKeyWords: "",
                errorMessage: "Ovo korisničko ime je već zauzeto!",
                existingData: { username, email }
            });
        }

        // Generate confirmation token
        const buffer = await crypto.randomBytes(32);
        const confirmToken = buffer.toString("hex");

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create new User object
        const user = new User({
            username,
            email,
            password: hashedPassword,
            userImage: userImageUrl,
            role: "user",
            userRecipes: [],
            savedRecipes: [],
            userBooks: [],
            savedBooks: [],
            followers: { count: 0, users: [] },
            following: { count: 1, users: [{ userId: new mongoose.Types.ObjectId("66617bae348cbb571c17416d") }] },
            views: { count: 0, users: [] },
            blocking: [],
            blockedBy: [],
            subscribers: { count: 0, users: [] },
            subscribed: { count: 0, users: [] },
            subCost: 0,
            boughtRecipes: [],
            boughtBooks: [],
            status: ["pending"],
            history: [],
            confirmToken,
            confirmTokenExpiration: Date.now() +  2 * 24 * 60 * 60 * 1000,
            confirmed: false,
            acceptance,
            wallet: 0,
        });

        // Save user to database
        await user.save();

        // Send confirmation email
        var mailOptions = {
            from: "Kuvajmo Zajedno",
            to: email,
            subject: "Uspešna Registracija",
            text: "Uspešna Registracija",
            html: `
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Uspešna Registracija</title>
                </head>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h1 style="color: #009688; margin-bottom: 20px;">Uspešna Registracija</h1>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${username},</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Hvala Vam na poverenju, Vaš nalog je uspešno registrovan, Vaše informacije su:</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 10px;"><strong>Korisničko Ime:</strong> ${username}</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;"><strong>Molimo Vas da zapišete šifru!</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Obavezno potvrdite email imate 48h, posle čega se možete prijaviti na aplikaciju!</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Ukoliko ne potvrdite, nalog će biti izbrisan po isteku roka!</p>
                        <a href="https://www.kuvajmozajedno.com/potvrdite-email/${confirmToken}" style="display: inline-block; padding: 12px 24px; background-color: #009688; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; transition: background-color 0.3s;">Potvrda Emaila</a>
                        <p style="color: #333; font-size: 16px; margin-top: 30px;">Aplikaciji možete pristupiti na <a href='https://www.kuvajmozajedno.com'>kuvajmozajedno.com</a></p>
                        <p style="color: #333; font-size: 16px; margin-top: 30px;">Za sva pitanja, nedoumice i asistenciju slobodno nas kontaktirajte.</p>
                    </div>
                </body>
                </html>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(error);
            } else {
                console.log("Email sent: " + info.response);
            }
        });

        // Update system user to follow the new user
        const systemUser = await User.findById("66617bae348cbb571c17416d").select("followers");
        systemUser.followers.users.push({ userId: user._id });
        systemUser.followers.count += 1;
        await systemUser.save();

        return res.status(201).render('transactions/email-sent', {
            path: "/poslat-email",
            pageTitle: "Proverite Vaš Email i Potvrdite nalog!",
            pageDescription: "",
            pageKeyWords: "",
            title: "Email uspešno poslat!",
            text: "Molimo Vas da proverite Vaš email i potvrdite nalog, obavezno proverite SPAM!"
        });

    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}


exports.postConfirmEmail = (req, res, next) => {
    // Get data from request.body
    const confirmToken = req.body.confirmToken;
    const userId = req.body.userId;
    const errors = validationResult(req);
  
    // Check data for errors
    if (!errors.isEmpty()) {
        // If yes redirect to /confirm-email/:confirmToken and reder error massage and existing data
        return res.status(422).render("auth/confirm-email", {
            path: `/confirm-email/${confirmToken}`,
            pageTitle: "Potvrda Emaila",
            pageDescription: "",
            pageKeyWords: "",
            confirmToken: confirmToken,
            userId: userId,
            errorMessage: errors.array()[0].msg,
      });
    }

    try {
        // If no errors find user with that token and id
        User.findOne({
        confirmToken: confirmToken,
        _id: userId,
        })
        .then(user => {
            // If no user redirect to /confirm-email/:confirmToken and reder error massage and existing data
            if (!user) {
                return res.status(422).render("auth/confirm-email", {
                    path: `/potvrdite-email/${confirmToken}`,
                    pageTitle: "Potvrda Emaila",
                    pageDescription: "",
                    pageKeyWords: "",
                    confirmToken: confirmToken,
                    userId: userId,
                    errorMessage: "Korisnik nije pronađen!",
                });
            }
            // If yes set confirmed to true confirmToken and confirmTokenExpiration to undefined and save to database
            user.confirmed = true;
            user.confirmToken = undefined;
            user.confirmTokenExpiration = undefined;
            let newStatus = user.status.filter(status => status != "pending");
            newStatus.push("active");
            user.status = newStatus;
            return user.save()
        })
        //   Redirect to /login
        .then(() => {
            res.redirect("/prijava");
        })
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postResetPassword = (req, res, next) => {
    // Get data from request.body
    const email = req.body.email;

    // Check data valdation
    const errors = validationResult(req);

    // If not render resetPassword page with error massage and existing data
    if (!errors.isEmpty()) {
        return res.status(422).render("auth/reset", {
            path: "/restartujte-sifru",
            pageTitle: "Restartovanje Šifre",
            pageDescription: "",
            pageKeyWords: "",
            errorMessage: errors.array()[0].msg,
            existingData: {
                email: email
            }
        });
    }

    try {
        // If yes create resetToken
        crypto.randomBytes(32, (err, buffer) => {
            // If not render resetPassword page with error massage and existing data
            if (err) {
                return res.status(422).render("auth/reset", {
                    path: "/restartujte-sifru",
                    pageTitle: "Restartovanje Šifre",
                    pageDescription: "",
                    pageKeyWords: "",
                    errorMessage: "Neuspešno generisanje Tokena",
                    existingData: {
                        email: email
                    }
                });
            }
            const token = buffer.toString("hex");

            // Check does user exist
            User.findOne({ email: email })
                .then((user) => {
                    // If not render resetPassword page with error massage and existing data
                    if (!user) {
                        return res.status(422).render("auth/reset", {
                            path: "/restartujte-sifru",
                            pageTitle: "Restartovanje Šifre",
                            pageDescription: "",
                            pageKeyWords: "",
                            errorMessage: "Nema korisnika sa tim emailom!",
                            existingData: {
                                email: email
                            }
                        });
                    }

                    // Save resetToken and resetTokenExpiration to user
                    user.resetToken = token;
                    user.resetTokenExpiration = Date.now() + 3600000;
                    return user
                        .save()
                        .then(() => {
                            var mailOptions = {
                                from: "Kuvajmo Zajedno",
                                to: user.email,
                                subject: "Zatražiliste Restartovanje Šifre",
                                text: "Zatražiliste Restartovanje Šifre",
                                html: `<html lang="en">
                                <head>
                                    <meta charset="UTF-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                    <title>Zatražiliste Restartovanje Šifre</title>
                                </head>
                                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">

                                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

                                        <h1 style="color: #009688; margin-bottom: 20px;">Restartujte Šifru</h1>

                                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${user.username},</p>

                                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">VI ste zatražili restartvonaje šifre. Kliknite na link ispod:</p>

                                        <a href="https://www.kuvajmozajedno.com/nova-sifra/${token}" style="display: inline-block; padding: 12px 24px; background-color: #009688; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; transition: background-color 0.3s;">Restartovanje Šifre</a>

                                        <p style="color: #333; font-size: 16px; margin-top: 30px;">Ako niste zatražili, ignorišite ovaj email.</p>

                                    </div>

                                </body>
                                </html>
                        `,
                            };

                            // Send email with link with dinamic data to user email
                            transporter.sendMail(mailOptions, function (error, info) {
                                if (error) {
                                    console.log(error);
                                } else {
                                    console.log("Email sent: " + info.response);
                                }
                            });

                            // Redirect to explorer page (/)
                            res.redirect("/");
                        })
                })
        });
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postNewPassword = (req, res, next) => {
    // Get data from request.body
    const newPassword = req.body.password;
    const userId = req.body.userId;
    const passwordToken = req.body.passwordToken;
    let resetUser;

    // Check data validation
    const errors = validationResult(req);

    // If not render resetPassword page with error massage and existing data
    if (!errors.isEmpty()) {
        return res.status(422).render("auth/new-password", {
            path: "/nova-sifra",
            pageTitle: "Nova Šifra",
            pageDescription: "",
            pageKeyWords: "",
            passwordToken: passwordToken,
            userId: userId,
            errorMessage: errors.array()[0].msg,
        });
    }

    try {
        // Find user and hashed newPassword
        User.findOne({
            resetToken: passwordToken,
            resetTokenExpiration: { $gt: Date.now() },
            _id: userId,
        })
        .then((user) => {
            if (!user) {
                return res.status(422).render("auth/new-password", {
                    path: "/nova-sifra",
                    pageTitle: "Nova Šifra",
                    pageDescription: "",
                    pageKeyWords: "",
                    passwordToken: passwordToken,
                    userId: userId,
                    errorMessage: "Korisnik nije pronađen!",
                });
            }
            resetUser = user;
            return bcrypt.hash(newPassword, 12);
        })
        .then((hashedPassword) => {
            // Set newPassword, resetToken and resetTokenExpiration
            resetUser.password = hashedPassword;
            resetUser.resetToken = undefined;
            resetUser.resetTokenExpiration = undefined;
            // Save user
            return resetUser.save();
        })
        .then(() => {
            // Redirect to login page
            res.redirect("/prijava");
        })
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postLogout = (req, res, next) => {
    // Delete session from database
    // Delete session for user
    req.session.destroy(() => {
        // Redirect to explorer (/)
        res.redirect("/");
    });
}