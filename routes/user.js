// Import express
const express = require("express");

// Import Router from express
const router = express.Router();

// Import validatros
const { check, body } = require("express-validator");

// Import Controllers
const userController = require("../controllers/user");

// Import Middleware
const isAuth = require('../middleware/is-auth');

const imageMiddleware = require('../middleware/image');

// Define routes
// -------------------------------------------------------- GET ------------------------------------------------------

router.get('/moj-profil', isAuth, userController.getMyProfile);

router.get('/novosti', isAuth, userController.getMyFeed);

router.get('/korisnik-profil/:userId', isAuth, userController.getUserProfile);

router.get('/recept-detalji/:recipeId', isAuth, userController.getRecipeDetails);

router.get('/recipe-categories/:category', isAuth, userController.getRecipesByCategory);

router.get('/knjiga-detalji/:bookId', isAuth, userController.getBookDetails);

router.get('/dodajte-recept', isAuth, userController.getAddRecipe);

router.get('/dodajte-knjigu', isAuth, userController.getAddBook);

router.get('/izmenite-recept/:recipeId', isAuth, userController.getEditRecipe);

router.get('/izmenite-knjigu/:bookId', isAuth, userController.getEditBook);

router.get('/istorija-detalji/:historyId', isAuth, userController.getHistoryDetails);

router.get('/zatrazite-isplatu/:withdrawalToken', userController.getNewWithdrawal);

router.get('/poslat-email', userController.getEmailSent);

// -------------------------------------------------------- POST -------------------------------------------------------------
// Validations needs to be added to post routes!!!

// EDIT-USER-IMAGE
router.post('/izmenite-korisnicku-sliku', isAuth, [
    body("userId").notEmpty().withMessage("Korisnički ID mora da postoji!"),
    body("subCost").custom((value, { req }) => {
        // Provera da li polje images postoji i da li je neophodno
        if (!req.files || req.files.length === 0) {
            throw new Error('Slika mora da se ubaci!');
        }
        // Ako je sve u redu, vrati true
        return true;
    })
], userController.postEditUserImage);

// EDIT-SUB-COST
router.post('/izmenite-cenu-pretplate', isAuth, [
    body("userId").notEmpty().withMessage("Korisnički ID mora da postoji!"),
    check('newSubCost')
    .exists().withMessage('Nova cena mora biti ubačena!')
    .isNumeric().withMessage('Nova cena mora biti broj!')
    .isFloat({ gte: 0 }).withMessage('Nova cena mora biti veća ili jednaka 0!'),
], userController.postEditSubCost);

// ADD-RECIPE
router.post('/dodajte-recept',
    isAuth,
    [
        body("title").notEmpty().withMessage("Naslov ne sme biti prazan!"),
        body("category")
            .exists()
            .withMessage("Recept mora da ima bar jednu Kategoriju!")
            .bail()
            .custom((value) => {
                if (!Array.isArray(value)) {
                    // If it's not an array, consider it as a single string
                    if (typeof value !== "string" || value.trim() === "") {
                        throw new Error("Kategorija ne sme da bude prazna!");
                    }
                } else {
                    // If it's an array, make sure every item is a non-empty strings
                    if (
                        value.some((item) => typeof item !== "string" || item.trim() === "")
                    ) {
                        throw new Error("Kategorija ne sme da bude prazna!");
                    }
                }
                return true;
            }),
        body("description")
            .isString()
            .withMessage("Opis mora da bude tekst dužine bar 1 karakter!")
            .isLength({ min: 1 })
            .withMessage("Opis ne sme da bude prazan!"),
        body("ingredients")
            .exists()
            .withMessage("Mora da postoji bar jedan Sastojak!")
            .bail()
            .custom((value) => {
                if (!Array.isArray(value)) {
                    if (typeof value !== "string" || value.trim() === "") {
                        throw new Error("Sastojak ne sme biti prazan!");
                    }
                } else {
                    if (
                        value.some((item) => typeof item !== "string" || item.trim() === "")
                    ) {
                        throw new Error("Sastojak ne sme biti prazan!");
                    }
                }
                return true;
            }),
        body("ingredientsAmount")
            .exists()
            .withMessage("Mora da postoji bar neka količina!")
            .bail()
            .custom((value) => {
                if (!Array.isArray(value)) {
                    if (typeof value !== "string" || value.trim() === "") {
                        throw new Error("Količina ne sme da bude prazna!");
                    }
                } else {
                    if (
                        value.some((item) => typeof item !== "string" || item.trim() === "")
                    ) {
                        throw new Error("Količina ne sme da bude prazna!");
                    }
                }
                return true;
            }),
        body("duration").isString().withMessage("Trajanje ne sme da bude prazno!"),
        body("steps")
            .exists()
            .withMessage("Mora da bude bar jedan korak!")
            .bail()
            .custom((value) => {
                if (!Array.isArray(value)) {
                    if (typeof value !== "string" || value.trim() === "") {
                        throw new Error("Korak ne sme da bude prazan!");
                    }
                } else {
                    if (
                        value.some((item) => typeof item !== "string" || item.trim() === "")
                    ) {
                        throw new Error("Korak ne sme da bude prazan!");
                    }
                }
                return true;
            }),
        body("note").isString().withMessage("Napomena ne sme da bude prazna!"),
    ],
    userController.postAddRecipe);

// ADD-BOOK
router.post('/dodajte-knjigu',
    isAuth,
    [
        body("title").notEmpty().withMessage("Naslov ne sme biti prazan!"),
        body('type').notEmpty().withMessage('Tip je obavezan!'),
        body('cost').notEmpty().withMessage('Cena je obavezna!'),
        body("description")
            .isString()
            .withMessage("Opis mora da bude tekst dužine bar 1 karakter!")
            .isLength({ min: 1 })
            .withMessage("Opis ne sme da bude prazan!"),
    ],
    userController.postAddBook);

// EDIT-RECIPE
router.post('/izmenite-recept', isAuth, [
    body("title").notEmpty().withMessage("Naslov ne sme da bude prazan!"),
        body("category")
            .exists()
            .withMessage("Recept mora da ima bar jednu kategoriju!")
            .bail()
            .custom((value) => {
                if (!Array.isArray(value)) {
                    // If it's not an array, consider it as a single string
                    if (typeof value !== "string" || value.trim() === "") {
                        throw new Error("Kategorija ne sme da bude prazna!");
                    }
                } else {
                    // If it's an array, make sure every item is a non-empty string
                    if (
                        value.some((item) => typeof item !== "string" || item.trim() === "")
                    ) {
                        throw new Error("Kategorija ne sme da bude prazna!");
                    }
                }
                return true;
            }),
        body("description")
            .isString()
            .withMessage("Opis mora da bude tekst!")
            .isLength({ min: 1 })
            .withMessage("Opis ne sme da bude prazan!"),
        body("ingredients")
            .exists()
            .withMessage("Mora da postoji bar jedan Sastojak!")
            .bail()
            .custom((value) => {
                if (!Array.isArray(value)) {
                    if (typeof value !== "string" || value.trim() === "") {
                        throw new Error("Sastojak ne sme da bude prazan!");
                    }
                } else {
                    if (
                        value.some((item) => typeof item !== "string" || item.trim() === "")
                    ) {
                        throw new Error("Sastojak ne sme da bude prazan!");
                    }
                }
                return true;
            }),
        body("ingredientsAmount")
            .exists()
            .withMessage("Mora da postoji neka količina")
            .bail()
            .custom((value) => {
                if (!Array.isArray(value)) {
                    if (typeof value !== "string" || value.trim() === "") {
                        throw new Error("Količina ne sme da bude prazna!");
                    }
                } else {
                    if (
                        value.some((item) => typeof item !== "string" || item.trim() === "")
                    ) {
                        throw new Error("Količina ne sme da bude prazna!");
                    }
                }
                return true;
            }),
        body("duration").isString().withMessage("Trajanje ne sme da bude prazno!"),
        body("steps")
            .exists()
            .withMessage("Mora da postoji bar jedan korak!")
            .bail()
            .custom((value) => {
                if (!Array.isArray(value)) {
                    if (typeof value !== "string" || value.trim() === "") {
                        throw new Error("Korak ne sme da bude prazan!");
                    }
                } else {
                    if (
                        value.some((item) => typeof item !== "string" || item.trim() === "")
                    ) {
                        throw new Error("Korak ne sme da bude prazan!");
                    }
                }
                return true;
            }),
        body("note").isString().withMessage("Napomena ne sme da bude prazna!"),
], userController.postEditRecipe);

// EDIT-BOOK
router.post('/izmenite-knjigu', isAuth, [
    body("title").notEmpty().withMessage("Naslov je obavezan!"),
        body('type').notEmpty().withMessage('Tip je obavezan'),
        body('cost').notEmpty().withMessage('Cena je obavezna'),
        body("description")
            .isString()
            .withMessage("Opis mora da bude tekst!")
            .isLength({ min: 1 })
            .withMessage("Opis ne sme da bude prazan!"),
], userController.postEditBook);

// RATE-RECIPE
router.post('/ocenite-recept', isAuth, [
    body("rate").exists().notEmpty().withMessage("Ocena mora da bude obavezna!"),
    body("recipeId").exists().notEmpty().withMessage("Mora da bude ID Recepta!"),
    body("userId").exists().notEmpty().withMessage("Mora da bude ID Korisnika!"),

], userController.postRateRecipe);

// SAVE-RECIPE
router.post('/sacuvajte-recept', isAuth, [], userController.postSaveRecipe);

// BUY-RECIPE
router.post('/kupite-recept', isAuth, [], userController.postBuyRecipe);

// BUY-BOOK
router.post('/kupite-knjigu', isAuth, [], userController.postBuyBook);

// SAVE-BOOK
router.post('/sacuvajte-knjigu', isAuth, [], userController.postSaveBook);

// ADD-RECIPE-TO-BOOK
router.post('/dodajte-recept-u-knjigu', isAuth,
    [
        body("bookSelect").notEmpty().withMessage("Knjiga mora biti izabrana!"),
        body("recipeId").notEmpty().withMessage("ID Recepta mora da postoji!")
    ],
    userController.postAddRecipeToBook);

// DELETE-RECIPE
router.post('/izbrisite-recept', isAuth, [], userController.postDeleteMyRecipe);

// DELETE-BOOK
router.post('/izbrisite-knjigu', isAuth, [
    body("bookId").exists().withMessage("ID Knjige mora da postoji!"),
], userController.postDeleteMyBook);

// DELETE-RECIPE-FROM-BOOK
router.post("/izbacite-recept-iz-knjige", isAuth, [], userController.postDeleteRecipeFromBook);

// DELETE-SAVED-RECIPE
router.post('/izbacite-sacuvan-recept', isAuth, [], userController.postDeleteSavedRecipe);

// DELETE-SAVED-BOOK
router.post('/izbacite-sacuvanu-knjigu', isAuth, [], userController.postDeleteSavedBook);

// FOLLOW-USER
router.post('/zapratite-korisnika', isAuth, [], userController.postFollowUser);

// UNFOLLOW-USER
router.post('/odpratite-korisnika', isAuth, [], userController.postUnfollowUser);

// SUBSCRIBE-TO-USER
router.post('/pretplatite-se-na-korisnika', isAuth, [], userController.postSubscribeToUser);

// UNSUBSCRIBE-FROM-USER
router.post('/prekinite-pretplatu-korisniku', isAuth, [], userController.postUnsubscribeFromUser);

// BLOCK-USER
router.post('/blokirajte-korisnika', isAuth, [
    body("userId").notEmpty().withMessage("ID Korisnika mora da postoji!")
], userController.postBlockUser);

// UNBLOCK-USER
router.post('/odblokirajte-korisnika', isAuth, [
    body("userId").notEmpty().withMessage("ID Korisnika mora da postoji!")
], userController.postUnblockUser);

router.post('/zatrazite-depozit', isAuth, [], userController.postRequestDeposit);

router.post('/postanite-kreator', isAuth, [], userController.postRequestCreator);

router.post('/zatrazite-deaktivaciju', isAuth, [], userController.postRequestDeactivation);

router.post('/zatrazite-isplatu', isAuth, [], userController.postRequestWithdrawal);

router.post('/nova-isplata', [], userController.postNewWithdrawal);

router.post('/nabavite-novu-verziju', isAuth, [], userController.postGetNewPurchaseVersion);

router.post('/dogadjaj-prijava', isAuth, [], userController.postAddUserToEvent);

router.post('/dogadjaj-dodavanje-recepta', isAuth, [], userController.postAddRecipeToEvent);

router.post('/glasanje-recept', isAuth, [], userController.postVoteForRecipe);

// Exports router 
module.exports = router;