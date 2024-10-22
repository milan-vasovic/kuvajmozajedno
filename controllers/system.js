// Import Models to be used and passed to template
const crypto = require("crypto");
const mongoose = require('mongoose');

const User = require("../models/user");
const Recipe = require("../models/recipe");
const Book = require("../models/book");
const Purchase = require("../models/purchase");
const History = require("../models/history");
const Event = require("../models/event");
const nodemailer = require("nodemailer");

const { validationResult } = require("express-validator");

const fs = require('fs');
const path = require('path');

// Učitavanje ključeva
const publicKey = fs.readFileSync(path.join(__dirname, '../keys', 'publicKey.pem'), 'utf8');
const privateKey = fs.readFileSync(path.join(__dirname, '../keys', 'privateKey.pem'), 'utf8');

// Funkcije za generisanje ključa i IV, šifrovanje i dešifrovanje
const generateKeyAndIV = () => {
    const key = crypto.randomBytes(32); // 256-bit ključ
    const iv = crypto.randomBytes(16); // 128-bit IV
    return { key, iv };
};

const encryptData = (text, key, iv) => {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

const encryptAESKey = (aesKey, publicKey) => {
    const encryptedKey = crypto.publicEncrypt(publicKey, aesKey);
    return encryptedKey.toString('hex');
};

const decryptAESKey = (encryptedAESKey, privateKey) => {
    const aesKeyBuffer = Buffer.from(encryptedAESKey, 'hex');
    const decryptedKey = crypto.privateDecrypt(privateKey, aesKeyBuffer);
    return decryptedKey;
};

const decryptData = (encryptedData, key, iv) => {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

// Setting trasporter
let transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_AUTH_USER,
        pass: process.env.EMAIL_AUTH_PASS,
    },
});

// ___________________________________________________________________GET_________________________________________________________________

exports.getWithdrawalRequests = (req, res, next) => {
    try {
        History.find({ type: "requestedWithdrawal" })
            .populate({
                path: 'purchaseId',
                select: 'data',
                populate: {
                    path: 'data.author',
                    model: 'User',
                    select: 'username'
                }
            })
            .then(histories => {
                return res.status(200).render("system/withdrawal-requests", {
                    path: "/system/withdrawal-requests",
                    pageTitle: "Withdrawal Requests",
                    pageDescription: "",
                    pageKeyWords: "",
                    histories: histories
                });
            })
            .catch(err => {
                const error = new Error("Unable to get Histories! " + err);
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getDepositRequests = (req, res, next) => {
    try {
        User.find({ status: "requestedDeposit" })
            .select('username userImage depositRequestExpiration')
            .then(users => {
                return res.status(200).render("system/deposit-requests", {
                    path: "/system/deposit-requests",
                    pageTitle: "Deposit Requests",
                    pageDescription: "",
                    pageKeyWords: "",
                    users: users
                })
            })
            .catch(err => {
                const error = new Error("Unable to get Users! " + err);
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getDepositFulfill = (req, res, next) => {
    try {
        const userId = req.params.userId;
        return res.status(200).render("system/deposit-fulfill", {
            path: "/deposit-fulfill",
            pageTitle: "Deposit Fulfill",
            pageDescription: "",
            pageKeyWords: "",
            userId: userId
        })
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getHistoryById = (req, res, next) => {
    try {
        const historyId = req.params.historyId;

        return History.findById(historyId)
            .populate({
                path: 'purchaseId',
                select: 'data',
                populate: {
                    path: 'data.author',
                    model: 'User',
                    select: 'username'
                }
            })
            .then(history => {
                if (history.type === "requestedWithdrawal") {
                    const decryptedAESKey = decryptAESKey(history.purchaseId.data.aesKey, privateKey);

                    const decryptedFirstname = decryptData(history.purchaseId.data.firstname, decryptedAESKey, Buffer.from(history.purchaseId.data.iv, 'hex'));
                    const decryptedLastname = decryptData(history.purchaseId.data.lastname, decryptedAESKey, Buffer.from(history.purchaseId.data.iv, 'hex'));
                    const decryptedAccountNumber = decryptData(history.purchaseId.data.accountNumber, decryptedAESKey, Buffer.from(history.purchaseId.data.iv, 'hex'));

                    return res.status(200).render("user/user-includes/new-history-details", {
                        path: "/istorija-detalji",
                        pageTitle: "History Details",
                        pageDescription: "",
                        pageKeyWords: "",
                        history: {
                            _id: history._id,
                            type: history.type,
                            date: history.date,
                            cost: history.cost,
                            purchaseId: {
                                _id: history.purchaseId._id,
                                data: {
                                    userId: history.purchaseId.data.userId,
                                    username: history.purchaseId.data.username,
                                    userImage: history.purchaseId.data.userImage,
                                    title: history.purchaseId.data.title,
                                    firstname: decryptedFirstname,
                                    lastname: decryptedLastname,
                                    accountNumber: decryptedAccountNumber
                                }
                            }
                        },
                        userRole: req.session.user.role,
                        haveNewVersion: false
                    });
                }

                return res.status(200).render("user/user-includes/new-history-details", {
                    path: "/istorija-detalji",
                    pageTitle: "History Details",
                    pageDescription: "",
                    pageKeyWords: "",
                    history: history,
                    userRole: req.session.user.role,
                    haveNewVersion: false
                });
            })
            .catch(err => {
                const error = new Error("Couldn't find history! " + err);
                error.httpStatusCode = 500;
                return next(error);
            })
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getDeposits = (req, res, next) => {
    try {
        History.find({ 
            $or: [
                { type: "deniedDeposit" },
                { type: "fulfilledDeposit" }
            ]
            })
            .populate({
                path: 'purchaseId',
                select: 'data',
                populate: {
                    path: 'data.author',
                    model: 'User',
                    select: 'username'
                }
            })
            .then(histories => {
                return res.status(200).render("system/deposits", {
                    path: "/system/deposits",
                    pageTitle: "Deposits",
                    pageDescription: "",
                    pageKeyWords: "",
                    histories: histories
                });
            })
            .catch(err => {
                const error = new Error("Unable to get Histories! " + err);
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getWithdrawals = (req, res, next) => {
    try {
        History.find({ 
            $or: [
                { type: "deniedWithdrawal" },
                { type: "fulfilledWithdrawal" }
            ]
            })
            .populate({
                path: 'purchaseId',
                select: 'data',
                populate: {
                    path: 'data.author',
                    model: 'User',
                    select: 'username'
                }
            })
            .then(histories => {
                return res.status(200).render("system/deposits", {
                    path: "/system/withdrawals",
                    pageTitle: "Withdrawals",
                    pageDescription: "",
                    pageKeyWords: "",
                    histories: histories
                });
            })
            .catch(err => {
                const error = new Error("Unable to get Histories! " + err);
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getEvents = async (req, res, next) => {
    try {
        currentDate = Date.now();
        const currentEvents = await Event.find({ endDate: { $gt: currentDate } })
            .select("title startDate endDate image type cost");
        const pastEvents = await Event.find({ endDate: {$lt: currentDate} })
            .select("title startDate endDate image type cost");
        const upcommingEvents = await Event.find({ startDate: {$gt: currentDate } })
            .select("title startDate endDate image type cost");

        return res.status(200).render("system/event", {
            path: "/system/event",
            pageTitle: "Događaji",
            pageDescription: "",
            pageKeyWords: "",
            currentEvents: currentEvents,
            pastEvents: pastEvents,
            upcommingEvents: upcommingEvents,
            activeCurrent: "active",
            activeFuture: undefined,
            activePast: undefined
        });
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getEventById = (req, res, next) => {
    try {
        const eventId = req.params.eventId;
        const event = Event.findById(eventId)
            .then(event => {
                return res.render('system/event-details', {
                    path: "/system/event-details",
                    pageTitle: event.title,
                    pageDescription: event.description,
                    pageKeyWords: "",
                    event: event,
                    activeParticipant: "active",
                    activeRecipes: undefined
                })
            })
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

// ________________________________________________________________POST____________________________________________________________

exports.postFulfillWithdrawal = async (req, res, next) => {
    const session = await mongoose.startSession();
    try { 
        session.startTransaction();

        const historyId = req.body.historyId;
        const loggedUser = req.session.user;

        const history = await History.findById(historyId)
            .populate({
                path: 'purchaseId',
                select: 'data',
                populate: {
                    path: 'data.author',
                    model: 'User',
                    select: 'username'
                }
            })
            .session(session);

        if (!history) {
            const error = new Error("Couldn't find history!");
            error.httpStatusCode = 404;

            throw error;
        }

        const systemCut = Math.ceil(+history.cost * 0.20);
        const leftOver = Number(+history.cost - systemCut);

        const isSystem = history.purchaseId.data.isSystem;

        if (isSystem) {
            const purchase = await Purchase.findById(history.purchaseId._id).session(session);

            if (!purchase) {
                const error = new Error("Couldn't find Purchase!");
                error.httpStatusCode = 404;

                throw error;
            }

            purchase.data = {
                userId: loggedUser._id,
                username: loggedUser.username,
                title: "withdrawal"
            };

            await purchase.save({ session });

            history.type = "fulfilledWithdrawal";
            history.date = Date.now();

            await history.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(201).redirect("/system/withdrawal-requests");
        } else {
            const lUser = await User.findById(loggedUser._id)
                                    .select("wallet systemWallet history")
                                    .session(session);

            if (!lUser) {
                const error = new Error("Couldn't find User!");
                error.httpStatusCode = 404;

                throw error;
            }

            lUser.wallet += systemCut;
            lUser.systemWallet -= history.cost;

            const newPurchase = new Purchase({
                data: {
                    userId: history.purchaseId.data.userId,
                    username: history.purchaseId.data.username,
                    title: "partnerFee",
                }
            });

            await newPurchase.save({ session });

            const newHistory = new History({
                type: "fulfilledDeposit",
                date: Date.now(),
                cost: systemCut,
                purchaseId: newPurchase._id
            });

            await newHistory.save({ session });

            lUser.history.push({ historyId: newHistory._id });

            await lUser.save({ session });

            const purchase = await Purchase.findById(history.purchaseId._id).session(session);

            if (!purchase) {
                const error = new Error("Couldn't find Purchase! Ovde puca");
                error.httpStatusCode = 404;

                throw error;
            }
            purchase.data = {
                userId: history.purchaseId.data.userId._id,
                username: history.purchaseId.data.username,
                title: "withdrawal"
            };
            
            await purchase.save({ session });

            history.type = "fulfilledWithdrawal";
            history.date = Date.now();

            await history.save({ session });

            const user = await User.findById(history.purchaseId.data.userId).select("username status email").session(session);

            if (!user) {
                const error = new Error("Unable to find User!");
                error.httpStatusCode = 500;

                throw error;
            }

            user.status = user.status.filter(elem => elem !== "requestedWithdrawal");
            await user.save({ session });

            let mailOptions = {
                from: "Kuvajmo Zajedno",
                to: user.email,
                subject: "Ispunjen zahtev za Isplatu",
                text: "Vaš zahtev za isplatu je ispunjen!",
                html: `
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Uspeh!</title>
                </head>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                
                    <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                
                        <h1 style="color: #009688; margin-bottom: 20px;">Uspešna Isplata!</h1>
                
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${user.username},</p>
                
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Vaš zahtev za isplatu je odobren i ispunjen.</p>

                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Isplaćeni iznos: <strong>${leftOver} RSD</strong>.</p>

                        <a href="https://www.kuvajmozajedno.com/prijava" style="display: inline-block; padding: 12px 24px; background-color: #009688; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; transition: background-color 0.3s;">Prijava</a>

                    </div>
                
                </body>
                </html>
                `,
            };

            transporter.sendMail(mailOptions, async (error, info) => {
                if (error) {
                    const newError = new Error("Nije moguće poslati email Korisniku!");
                    newError.httpStatusCode = 500;

                    await session.abortTransaction();
                    session.endSession();
                    return next(newError);
                } else {
                    await session.commitTransaction();
                    session.endSession();
                    return res.status(201).redirect("/system/withdrawal-requests");
                }
            });
        }
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;

        await session.abortTransaction();
        session.endSession();

        return next(error);
    }
};

exports.postDenayWithdrawal = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const historyId = req.body.historyId;
        const history = await History.findById(historyId)
            .populate({
                path: 'purchaseId',
                select: 'data',
                populate: {
                    path: 'data.author',
                    model: 'User',
                    select: 'username'
                }
            })
            .session(session);

        if (!history) {
            const error = new Error("Couldn't find history!");
            error.httpStatusCode = 404;
            throw error;
        }

        const user = await User.findById(history.purchaseId.data.userId)
            .select("wallet email username status")
            .session(session);

        if (!user) {
            const error = new Error("Couldn't find User!");
            error.httpStatusCode = 404;
            throw error;
        }

        user.wallet += Number(history.cost);
        let newStatus = user.status.filter(status => status !== "requestedWithdrawal");
        user.status = newStatus;
        await user.save();

        const purchase = await Purchase.findById(history.purchaseId._id)
            .session(session);

        if (!purchase) {
            const error = new Error("Couldn't find Purchase!");
            error.httpStatusCode = 404;
            throw error;
        }

        purchase.data = {
            userId: history.purchaseId.data.userId._id,
            username: history.purchaseId.data.username,
            title: "withdrawal"
        };
        await purchase.save();

        history.type = "deniedWithdrawal";
        history.date = Date.now();
        await history.save();

        // Sending email
        const mailOptions = {
            from: "Kuvajmo Zajedno",
            to: user.email,
            subject: "Odbijen zahtev za Isplatu",
            text: "Vaš zahtev za isplatu je odbijen!",
            html: `
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Odbijeno</title>
                </head>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                    <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h1 style="color: #009688; margin-bottom: 20px;">Odbijen zahtev!</h1>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${user.username},</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Vaš zahtev za isplatu je odbijen.</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Traženi iznos: <strong>${history.cost} RSD</strong>.</p>
                        <a href="https://www.kuvajmozajedno.com/prijava" style="display: inline-block; padding: 12px 24px; background-color: #009688; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; transition: background-color 0.3s;">Prijava</a>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);

        await session.commitTransaction();
        session.endSession();

        return res.status(201).redirect("/system/withdrawal-requests");
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = err.httpStatusCode || 500;
        return next(error);
    }
};

exports.postFulfillDeposit = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.body.userId;
        const amount = +req.body.amount;
        const loggedUser = req.session.user;

        const user = await User.findById(userId).select("history wallet status email username").session(session);
        if (!user) {
            throw new Error("Couldn't find user!");
        }

        const purchaseForUser = new Purchase({
            data: {
                userId: user._id,
                username: user.username,
                title: "deposit"
            }
        });
        await purchaseForUser.save({ session });

        const historyForUser = new History({
            type: "fulfilledDeposit",
            date: Date.now(),
            cost: amount,
            purchaseId: purchaseForUser._id
        });
        await historyForUser.save({ session });

        user.history.push({ historyId: historyForUser._id });
        user.wallet += amount;
        user.status = user.status.filter(elem => elem !== "requestedDeposit");

        await user.save({ session });

        const mailOptions = {
            from: "Kuvajmo Zajedno",
            to: user.email,
            subject: "Uspešan Depozit",
            text: "Vaš depozit je uspešan!",
            html: `
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Usepšan depozit!</title>
                </head>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                    <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h1 style="color: #009688; margin-bottom: 20px;">Uspešan Depozit!</h1>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${user.username},</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Vaš zahtev za depozit je uspešan i ispunjen.</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Iznos: <strong>${amount} RSD</strong>.</p>
                        <a href="https://www.kuvajmozajedno.com/prijava" style="display: inline-block; padding: 12px 24px; background-color: #009688; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; transition: background-color 0.3s;">Prijava</a>
                    </div>
                </body>
                </html>
            `,
        };

        transporter.sendMail(mailOptions, async function (error, info) {
            if (error) {
                await session.abortTransaction();
                session.endSession();
                const newError = new Error("Nije moguće poslati email Korisniku!");
                newError.httpStatusCode = 500;
                return next(newError);
            } else {
                const lUser = await User.findById(loggedUser._id).select('systemWallet').session(session);
                if (!lUser) {
                    throw new Error("Nije moguće pronaći prijavljenog Korisnika!!");
                }
                lUser.systemWallet += amount;
                await lUser.save({ session });

                await session.commitTransaction();
                session.endSession();
                return res.status(201).redirect("/system/deposit-requests");
            }
        });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postDenayDeposit = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.body.userId;

        const user = await User.findById(userId)
            .select("status history username email depositRequestExpiration")
            .session(session);

        if (!user) {
            throw new Error("Unable to find user!");
        }

        const isRequested = user.status.includes("requestedDeposit");
        const hasExpiration = user.depositRequestExpiration < Date.now();

        if (isRequested && hasExpiration) {
            user.status = user.status.filter(elem => elem !== "requestedDeposit");
            user.depositRequestExpiration = undefined;

            const purchase = new Purchase({
                data: {
                    userId: user._id,
                    username: user.username,
                    title: "deposit"
                }
            });

            await purchase.save({ session });

            const history = new History({
                type: "deniedDeposit",
                date: Date.now(),
                cost: 0,
                purchaseId: purchase._id
            });

            await history.save({ session });

            user.history.push({ historyId: history._id });

            await user.save({ session });

            const mailOptions = {
                from: "Kuvajmo Zajedno",
                to: user.email,
                subject: "Odbijen Depozit",
                text: "Vaš zahtev za depozit je odbijen!",
                html: `
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Odbijen Depozit</title>
                </head>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                    <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h1 style="color: #009688; margin-bottom: 20px;">Odbijen Depozit!</h1>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${user.username},</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Vaš zahtev za depozit je odbijen i nije ispunjen!.</p>
                        <a href="https://www.kuvajmozajedno.com/prijava" style="display: inline-block; padding: 12px 24px; background-color: #009688; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; transition: background-color 0.3s;">Prijava</a>
                    </div>
                </body>
                </html>
                `,
            };

            transporter.sendMail(mailOptions, async function (error, info) {
                if (error) {
                    await session.abortTransaction();
                    session.endSession();
                    const newError = new Error("Nije moguće poslati email Korisniku!");
                    newError.httpStatusCode = 500;
                    return next(newError);
                } else {
                    await session.commitTransaction();
                    session.endSession();
                    return res.status(201).redirect("/system/deposit-requests");
                }
            });
        } else {
            throw new Error("Nije moguće odbiti Depozit!");
        }
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.checkUsersConformation = async (req, res, next) => {
    try {
        const users = await User.find({confirmed: false})
            .select("confirmTokenExpiration");

        const uncofirmedUsers = [];
        users.forEach(user => {
            if (!user.confirmTokenExpiration || (user.confirmTokenExpiration && user.confirmTokenExpiration < Date.now())) {
                uncofirmedUsers.push(user);
            }
        });

        if (uncofirmedUsers.length > 0) {
            uncofirmedUsers.forEach(e => {
                User.updateOne(
                    { _id: "66617bae348cbb571c17416d" },
                    {
                      $inc: { 'followers.count': -1 },
                      $pull: { 'followers.users': { userId: e._id } }
                    }
                ).then(() => {
                    console.log("Uspenso izbacen korisnik iz pracenja")
                    User.deleteOne({ "_id": e._id })
                        .then(() => {
                            console.log("Uspenso izbrisan korisnik")
                        })
                        .catch(err => console.log(err));
                })
            })
        } else {
            console.log("There are no uncofirmed users!");
        }
    } catch (err) {
        return console.log(err);
    }
}

exports.checkUsersActivity = async (req, res, next) => {
    try {
        const users = await User.find({ status: { $nin: ["inactive","suspended"] }})
            .select("lastLogin status");

        const inactiveUsers = [];
        users.forEach(user => {
            if ((!user.lastLogin && !user.status.includes('active')) || (user.lastLogin + 30 * 24 * 60 * 60 * 1000 < Date.now())) {
                inactiveUsers.push(user);
            }
        })

        if (inactiveUsers.length > 0) {
            const ids = inactiveUsers.map(obj => obj._id);
            updateUsers(ids)
        } else {
            console.log("there is no inactive users yet!");
        }

    } catch (err) {
        return console.log(err);
    }
}

async function updateUsers(ids) {
    try {
        await User.updateMany(
            { _id: { $in: ids } },
            { $pull: { status: 'active' } }
        );

        const result = await User.updateMany(
            { _id: { $in: ids } },
            {
                $set: {
                    suspendDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                },
                $addToSet: {
                    status: 'inactive'
                }
            }
        );

        console.log('Success! ' + result);
    } catch (error) {
        return console.error('Greška prilikom ažuriranja:', error);
    }
};

exports.finsihEvent = async (req, res, next) => {
    try {
        const currentDate = Date.now();
        const events = await Event.find({
            endDate: {$lt: currentDate},
            status: "progress"
        })

        if (events.length > 0) {
            events.forEach(event => {
                const sortedRecipes = event.content.sort((a, b) => {
                    if (b.votes.count === a.votes.count) {
                        return b.recipe.views.count - a.recipe.views.count;
                    }
                    return b.votes.count - a.votes.count;
                });

                 // Dobij listu `userId` autora sortiranih recepata
                const sortedAuthorIds = sortedRecipes.map(recipe => recipe.author.userId.toString());

                // Sortiraj učesnike (`participants`) na osnovu redosleda autora iz sortiranih recepata
                const sortedParticipants = event.participants.sort((a, b) => {
                    // Poredi indekse `userId` u `sortedAuthorIds`
                    return sortedAuthorIds.indexOf(a.userId.toString()) - sortedAuthorIds.indexOf(b.userId.toString());
                });

                sortedParticipants.forEach((user, index) => {
                    user.place = index + 1;
                    if (user.place < 4) {
                        user.isWinner = true;
                    }
                })

                event.status = "finished";
                event.save();
            })
        }
    } catch (error) {
        return console.error('Greška prilikom ažuriranja:', error);
    }
}

exports.randomDailyRecipe = async () => {
    const currentDate = new Date();
    const endOfToday = new Date();
    endOfToday.setDate(currentDate.getDate() + 1);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(currentDate.getDate() + 7);

    try {
        // Step 1: Use aggregation to get a random recipe
        const randomRecipe = await Recipe.aggregate([
            { $match: {
                type: 'public',
                $or: [
                    { shownDate: { $lt: new Date() } },
                    { shownDate: null }
                ],
                $or: [
                    { cooldownDate: { $lt: new Date() } },
                    { cooldownDate: null }
                ]
            }},
            { $sample: { size: 1 } } // Randomly select 1 recipe
        ]);

        if (randomRecipe.length > 0) {
            const selectedRecipe = randomRecipe[0];

            // Step 2: Update the selected recipe with shownDate and coolDown
            const updatedRecipe = await Recipe.findByIdAndUpdate(
                selectedRecipe._id,
                {
                    $set: {
                        shownDate: endOfToday, // Set to the end of today's date
                        cooldownDate: sevenDaysFromNow // Set a 7-day cool down
                    }
                },
                { new: true } // Return the updated document
            );

            console.log('Selected Recipe of the Day:', updatedRecipe);
        } else {
            console.log('No available recipes to show today.');
        }
    } catch (error) {
        console.error('Error selecting Recipe of the Day:', error);
    }
}