const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardcontroller');
const { protect } = require('../middleware/auth');


router.use(protect);

router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;