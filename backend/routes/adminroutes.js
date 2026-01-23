const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admincontroller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

router.get('/stats', adminController.getAdminStats);
router.get('/users', adminController.getUsers);
router.put('/users/:userId', adminController.updateUser);
router.get('/activity', adminController.getActivity);
router.get('/results/:examId', adminController.getExamResults);

module.exports = router;