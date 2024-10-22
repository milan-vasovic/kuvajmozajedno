const express = require("express");

const router = express.Router();

const gymController = require("../../controllers/fitness/gym");

router.get('/teretane', gymController.getGyms)

module.exports = router;