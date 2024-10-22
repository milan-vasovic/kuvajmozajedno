// Import express
const express = require("express");

// Import validatros
const { check, body } = require("express-validator");

// Import Router from express
const router = express.Router();

// Import Controllers
const forumController = require("../controllers/forum");

// Import Middleware
const isAuth = require('../middleware/is-auth');

router.get('/', forumController.getForum);

router.get('/:topicId', forumController.getTopicById);

router.post('/dodajte-komentar', [
    body("content").notEmpty().withMessage("Komentar ne sme da bude prazan!"),
    check('topicId')
    .exists()
    .withMessage('topicId je obavezan!')
], isAuth, forumController.postTopicComment);

// Exports router 
module.exports = router;