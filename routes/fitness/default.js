const express = require("express");

const router = express.Router();

const defaultontroller = require("../../controllers/fitness/default");

router.get('/', defaultontroller.getHome);

module.exports = router;