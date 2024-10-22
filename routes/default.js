// Import express
const express = require("express");

// Import Router from express
const router = express.Router();

// Import validatros
const { check, body } = require("express-validator");

// Import Controllers
const defaultController = require("../controllers/default");
const image = require('../middleware/image');

// Define routes
// ------------------------------------------------------------ Get -------------------------------------------------------

router.get('/', defaultController.getChoseApp);

router.get('/pronadji', defaultController.getExplorer);

router.get('/uslovi-koriscenja', defaultController.getTermsAndCondtions);

router.get('/politika-privatnosti', defaultController.getPrivacyPolicy);

router.get('/o-nama', defaultController.getAbout);

router.get('/images/:imagePath', image, defaultController.getImages);

router.get('/images/uploads/:imagePath', image, defaultController.getClodinaryImages);

router.get('/pozivnica/', defaultController.getLeandingPage);
router.get('/pozivnica/:name', defaultController.getLeandingPage);

router.get('/dogadjaji', defaultController.getEvents);

router.get('/dogadjaj-detalji/:eventId', defaultController.getEventById);
// Exports router 
module.exports = router;