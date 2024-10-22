// Import express
const express = require("express");

// Import Router from express
const router = express.Router();

// Import validatros
const { check, body } = require("express-validator");

// Import Controllers
const apiRecipesController = require("../controllers/api-recipes");

// Define routes
// ------------------------------------------------------------ Get -------------------------------------------------------

router.get('/recipes', apiRecipesController.getRecipes);

// Exports router 
module.exports = router;