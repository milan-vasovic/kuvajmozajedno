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

router.get('/admin-profile', isAuth, isAdmin, adminController.getAdminProfile);

router.get('/recipes', isAuth, isAdmin, adminController.getAdminRecipes);

router.get('/books', isAuth, isAdmin, adminController.getAdminBooks);

router.get('/users', isAuth, isAdmin, adminController.getAdminUsers);

router.get('/recipe-details/:recipeId', isAuth, isAdmin, adminController.getAdminRecipeById);

router.get('/book-details/:bookId', isAuth, isAdmin, adminController.getAdminBookById);

router.get('/user-details/:userId', isAuth, isAdmin, adminController.getAdminUserById);

router.get('/edit-recipe/:recipeId', isAuth, isAdmin, adminController.getAdminEditRecipe);

router.get('/edit-book/:bookId', isAuth, isAdmin, adminController.getAdminEditBook);

router.get('/edit-user/:userId', isAuth, isAdmin, adminController.getAdminEditUser);

router.get('/history/:historyId', isAuth, isAdmin, [], adminController.getHistoryById);

// ---------------------------------------------------------- POST -----------------------------------------------------
// Validations needs to be added to post routes!!!

router.post('/recipes-search', isAuth, isAdmin, adminController.postRecipeSearch);

router.post('/books-search', isAuth, isAdmin, adminController.postBookSearch);

router.post('/users-search', isAuth, isAdmin, adminController.postUserSearch);

// EDIT-RECIPE
router.post('/edit-recipe', [], isAuth, isAdmin, adminController.postAdminEditRecipe);

// EDIT-BOOK
router.post('/edit-book', [], isAuth, isAdmin, adminController.postAdminEditBook);

// EDIT-USER
router.post('/edit-user', [
    body("username").notEmpty().withMessage("Username can't be empty"),
    body('email').notEmpty().withMessage("Email can't be empty"),
    body('role').notEmpty().withMessage("Role can't be empty"),
], isAuth, isAdmin, adminController.postAdminEditUser);

// DELETE-RECIPE
router.post('/delete-recipe', [], isAuth, isAdmin, adminController.postAdminDeleteRecipe);

// DELETE-BOOK
router.post('/delete-book', [], isAuth, isAdmin, adminController.postAdminDeleteBook);

// DELETE-USER
router.post('/delete-user', [], isAuth, isAdmin, adminController.postAdminDeleteUser);

// POST SUSPEND USER
router.post('/suspend-user', [], isAuth, isAdmin, adminController.postSuspendUser);

// POST DEACTIVATE USER
router.post('/deactivate-user', [], isAuth, isAdmin, adminController.postDeactivateUser);

// POST ACTIVATE USER
router.post('/activate-user', [], isAuth, isAdmin, adminController.postActivateUser);

// Exports router 
module.exports = router;
