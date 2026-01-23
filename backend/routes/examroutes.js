const express = require('express');
const router = express.Router();
const examController = require('../controllers/examcontroller');
const dashboardController = require('../controllers/dashboardcontroller');
const { protect, authorize } = require('../middleware/auth');




router.use(protect);


router.get('/active', dashboardController.getActiveExams);
router.get('/history', dashboardController.getExamHistory);
router.post('/:examId/progress', dashboardController.saveExamProgress);
router.get('/:examId/progress', dashboardController.getExamProgress);
router.post('/:examId/submit', dashboardController.submitExam);


router.get('/:id', examController.getExamWithQuestions);
router.post('/:id/start', examController.startExam);
router.get('/:id/summary', examController.getExamSummary);
router.get('/:id/results', examController.getExamResults);
router.post('/:id/auto-submit', examController.autoSubmitExam);


router.get('/:examId/questions/:questionId', examController.getQuestion);
router.post('/:examId/questions/:questionId/answer', examController.saveAnswer);
router.post('/:examId/questions/:questionId/mark', examController.markQuestion);
router.delete('/:examId/questions/:questionId/answer', examController.clearAnswer);


router.get('/', authorize('admin', 'teacher'), examController.getAllExams);
router.post('/', authorize('admin', 'teacher'), examController.createExam);
router.put('/:id', authorize('admin', 'teacher'), examController.updateExam);
router.delete('/:id', authorize('admin'), examController.deleteExam);
router.get('/:id/questions/all', authorize('admin', 'teacher'), examController.getAllQuestions);
router.post('/:id/questions', authorize('admin', 'teacher'), examController.addQuestion);

module.exports = router;