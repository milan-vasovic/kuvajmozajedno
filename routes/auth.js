// Import express
const express = require("express");

// Import Router from express
const router = express.Router();

// Import validatros
const { check, body } = require("express-validator");

// Import Controllers
const authController = require("../controllers/auth");

// Import Middleware
const isAuth = require('../middleware/is-auth');

// Define routes
// -------------------------------------------------------- GET -------------------------------------------------------

router.get('/prijava', authController.getLogin);

router.get('/registracija', authController.getSignup);

router.get('/potvrdite-email/:confirmToken', authController.getConfirmEmail);

router.get('/restartujte-sifru', authController.getResetPassword);

router.get('/nova-sifra/:token', authController.getNewPasword);

router.get('/email-sent', authController.getEmailSent);

// ------------------------------------- ------------------ POST ---------------------------------------------------------
// Validations needs to be added to post routes!!!

// LOGIN
router.post('/prijava',
    [
        check('email')
        .isEmail()
        .withMessage("Unesite validan Email!"),
        body(
            'password',
            "Šifra mora da ima bar 5 karaktera!"
        )
        .isLength({min:5}),
    ],
    authController.postLogin);

// LOGOUT
router.post(
    '/logout', [], isAuth, authController.postLogout);

// SIGNUP
router.post('/registracija',
    [
        check('email')
        .isEmail()
        .withMessage("Unesite validan Email!"),
        body(
            'password',
            "Šifra mora da ima bar 5 karaktera!"
        )
        .isLength({min:5}),
        body('confirmPassword')
        .custom((value, {req}) => {
            if (value === req.body.password) {
                return true;
            }
            throw new Error("Šifra i Potvrđena Šifra moraju da se poklapaju!");
        }),
        check('acceptance')
        .exists()
        .withMessage("Morate prihvatiti Uslove Korišćenja i Politiku Privatnosti!")
    ],
    authController.postSignup);

// CONFIRM-EMAIL
router.post('/potvrdite-email',
    [
        check('confirmToken')
        .exists()
        .withMessage("Mora da postoji confirmToken!"),
        check('userId')
        .exists()
        .withMessage("Mora da postoji ID Korisnika!")
    ],
    authController.postConfirmEmail);

// RESET-PASSWORD
router.post('/restartujte-sifru',
    [
        check('email')
        .isEmail()
        .withMessage("Unesite validan Email!")
    ],
    authController.postResetPassword);

// NEW-PASSWORD
router.post('/nova-sifra',
    [
        body('password')
        .isLength({min:5})
        .withMessage("Šifra mora da ima bar 5 karaktera!"),
        body("confirmPassword")
        .custom((value, {req}) => {
            if (value === req.body.password) {
                return true;
            }
            throw new Error("Šifra i Potvrđena Šifra moraju da se poklapaju!")
        })
    ],
    authController.postNewPassword);


// Exports router 
module.exports = router;
