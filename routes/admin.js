// Import express
const express = require("express");

// Import Router from express
const router = express.Router();

// Import validatros
const { check, body } = require("express-validator");

// Import Controllers
const adminController = require("../controllers/admin")

// Import Middleware
const isAuth = require('../middleware/is-auth');
const isAdmin = require('../middleware/is-admin');


// Define routes
// --------------------------------------------------------- GET -----------------------------------------------------------
// All routes have '/admin/' before the rest of route

router.get('/admin-profil', isAuth, isAdmin, adminController.getAdminProfile);

router.get('/recepti', isAuth, isAdmin, adminController.getAdminRecipes);

router.get('/knjige', isAuth, isAdmin, adminController.getAdminBooks);

router.get('/korisnici', isAuth, isAdmin, adminController.getAdminUsers);

router.get('/recept-detalji/:recipeId', isAuth, isAdmin, adminController.getAdminRecipeById);

router.get('/knjiga-detalji/:bookId', isAuth, isAdmin, adminController.getAdminBookById);

router.get('/korisnik-detalji/:userId', isAuth, isAdmin, adminController.getAdminUserById);

router.get('/izmenite-recept/:recipeId', isAuth, isAdmin, adminController.getAdminEditRecipe);

router.get('/izmenite-knjigu/:bookId', isAuth, isAdmin, adminController.getAdminEditBook);

router.get('/izmenite-korisnika/:userId', isAuth, isAdmin, adminController.getAdminEditUser);

router.get('/istorija/:historyId', isAuth, isAdmin, [], adminController.getHistoryById);

// ---------------------------------------------------------- POST -----------------------------------------------------
// Validations needs to be added to post routes!!!

router.post('/recepti-pretraga', isAuth, isAdmin, adminController.postRecipeSearch);

router.post('/knjige-pretraga', isAuth, isAdmin, adminController.postBookSearch);

router.post('/korisnici-pretraga', isAuth, isAdmin, adminController.postUserSearch);

// EDIT-RECIPE
router.post('/izmenite-recept', [
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
], isAuth, isAdmin, adminController.postAdminEditRecipe);

// EDIT-BOOK
router.post('/izmenite-knjigu', [], isAuth, isAdmin, adminController.postAdminEditBook);

// EDIT-USER
router.post('/izmenite-korisnika', [
    body("username").notEmpty().withMessage("Username can't be empty"),
    body('email').notEmpty().withMessage("Email can't be empty"),
    body('role').notEmpty().withMessage("Role can't be empty"),
], isAuth, isAdmin, adminController.postAdminEditUser);

// DELETE-RECIPE
router.post('/izbrisite-recept', [], isAuth, isAdmin, adminController.postAdminDeleteRecipe);

// DELETE-BOOK
router.post('/izbrisite-knjigu', [], isAuth, isAdmin, adminController.postAdminDeleteBook);

// DELETE-USER
router.post('/izbrisite-korisnika', [], isAuth, isAdmin, adminController.postAdminDeleteUser);

// POST SUSPEND USER
router.post('/suspenzija-korisnika', [], isAuth, isAdmin, adminController.postSuspendUser);

// POST DEACTIVATE USER
router.post('/deaktivacija-korisnika', [], isAuth, isAdmin, adminController.postDeactivateUser);

// POST ACTIVATE USER
router.post('/aktivacija-korisnika', [], isAuth, isAdmin, adminController.postActivateUser);

// Exports router 
module.exports = router;
