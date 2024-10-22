// Import express
const express = require("express");

// Import Router from express
const router = express.Router();

// Import validatros
const { check, body } = require("express-validator");

// Import Controllers
const systemController = require("../controllers/system");

// Import Middleware
const isAuth = require('../middleware/is-auth');

const isSystem = require('../middleware/is-system');

// Define routes
// -------------------------------------------------------- GET ------------------------------------------------------
router.get('/deposits', isAuth, isSystem, [], systemController.getDeposits);

router.get('/withdrawals', isAuth, isSystem, [], systemController.getWithdrawals);

router.get('/withdrawal-requests', isAuth, isSystem, [], systemController.getWithdrawalRequests);

router.get('/deposit-requests', isAuth, isSystem, [], systemController.getDepositRequests);

router.get('/deposit-fulfill/:userId', isAuth, isSystem, [], systemController.getDepositFulfill);

router.get('/history/:historyId', isAuth, isSystem, [], systemController.getHistoryById);

router.get('/dogadjaji', isAuth, isSystem, [], systemController.getEvents);

router.get('/dogadjaj-detalji/:eventId', isAuth, isSystem, [], systemController.getEventById);

// -------------------------------------------------------- POST ------------------------------------------------------

router.post('/fulfill-withdrawal', isAuth, isSystem, [], systemController.postFulfillWithdrawal);

router.post('/denay-withdrawal', isAuth, isSystem, [], systemController.postDenayWithdrawal);

router.post('/fulfill-deposit', isAuth, isSystem, [], systemController.postFulfillDeposit);

router.post('/denay-deposit', isAuth, isSystem, [], systemController.postDenayDeposit);

// Exports router 
module.exports = router;