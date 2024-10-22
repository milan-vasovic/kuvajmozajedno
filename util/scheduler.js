const cron = require('node-cron');
const systemController = require('../controllers/system');
const adminController = require('../controllers/admin');

// Every day at midnight
cron.schedule('0 0 * * *', (req, res, next) => {
    systemController.checkUsersConformation();
    systemController.checkUsersActivity();
    adminController.checkUsersSuspention();
    adminController.checkUsersDelete();
    systemController.randomDailyRecipe();
    systemController.finsihEvent();
})

