const Result = require('../models/result');
const Exam = require('../models/exam');

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        
        const totalExams = await Result.countDocuments({ user: userId });
        
        
        const completedExams = await Result.countDocuments({ 
            user: userId, 
            status: 'completed' 
        });
        
        
        const results = await Result.find({ 
            user: userId, 
            status: 'completed' 
        }).select('percentage');
        
        const avgScore = results.length > 0 
            ? results.reduce((sum, result) => sum + result.percentage, 0) / results.length 
            : 0;
        
        
        const allExams = await Exam.find({ 
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });
        
        const takenExams = await Result.find({ 
            user: userId 
        }).select('exam');
        
        const takenExamIds = takenExams.map(r => r.exam.toString());
        const pendingExams = allExams.filter(exam => 
            !takenExamIds.includes(exam._id.toString())
        ).length;
        
        res.json({
            success: true,
            stats: {
                totalExams,
                avgScore: Math.round(avgScore),
                completedExams,
                pendingExams
            }
        });
        
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard statistics'
        });
    }
};


exports.getActiveExams = async (req, res) => {
    try {
        const userId = req.user.id;
        
        
        const activeExams = await Exam.find({
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            $or: [
                { allowedUsers: { $size: 0 } }, 
                { allowedUsers: userId } 
            ]
        }).select('title description duration totalMarks startDate endDate')
          .populate('createdBy', 'username fullName')
          .sort({ startDate: 1 });
        
        
        const examIds = activeExams.map(exam => exam._id);
        const results = await Result.find({
            user: userId,
            exam: { $in: examIds }
        });
        
        const examsWithStatus = activeExams.map(exam => {
            const result = results.find(r => r.exam.toString() === exam._id.toString());
            return {
                ...exam.toObject(),
                attempted: !!result,
                attemptStatus: result ? result.status : 'not_attempted',
                score: result ? result.percentage : null
            };
        });
        
        res.json({
            success: true,
            exams: examsWithStatus,
            count: examsWithStatus.length
        });
        
    } catch (error) {
        console.error('Active exams error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching active exams'
        });
    }
};


exports.getExamHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const results = await Result.find({ 
            user: userId 
        })
        .populate({
            path: 'exam',
            select: 'title description duration totalMarks'
        })
        .sort({ submittedAt: -1 })
        .limit(20);
        
        const history = results.map(result => ({
            id: result._id,
            examId: result.exam._id,
            examName: result.exam.title,
            score: result.percentage,
            totalMarks: result.exam.totalMarks,
            status: result.status,
            date: result.submittedAt || result.createdAt,
            timeTaken: result.timeTaken,
            duration: result.exam.duration
        }));
        
        res.json({
            success: true,
            history,
            count: history.length
        });
        
    } catch (error) {
        console.error('Exam history error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching exam history'
        });
    }
};


exports.saveExamProgress = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user.id;
        const { currentQuestion, userAnswers, timeRemaining } = req.body;
        
        
        let result = await Result.findOne({
            user: userId,
            exam: examId,
            status: { $in: ['in_progress', 'submitted'] }
        });
        
        if (!result) {
            result = await Result.create({
                user: userId,
                exam: examId,
                status: 'in_progress'
            });
        }
        
        
        result.progress = {
            currentQuestion,
            userAnswers,
            timeRemaining
        };
        
        await result.save();
        
        res.json({
            success: true,
            message: 'Progress saved successfully'
        });
        
    } catch (error) {
        console.error('Save progress error:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving exam progress'
        });
    }
};


exports.getExamProgress = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user.id;
        
        const result = await Result.findOne({
            user: userId,
            exam: examId,
            status: { $in: ['in_progress', 'submitted'] }
        });
        
        if (!result) {
            return res.json({
                success: true,
                progress: null
            });
        }
        
        res.json({
            success: true,
            progress: result.progress
        });
        
    } catch (error) {
        console.error('Get progress error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching exam progress'
        });
    }
};


exports.submitExam = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user.id;
        const { answers, timeTaken } = req.body;
        
        
        const exam = await Exam.findById(examId).populate('questions');
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }
        
        
        let totalMarksObtained = 0;
        const detailedAnswers = [];
        
        exam.questions.forEach(question => {
            const userAnswer = answers[question._id];
            let isCorrect = false;
            let marksObtained = 0;
            
            if (userAnswer) {
                if (question.type === 'mcq') {
                    isCorrect = question.correctAnswers.includes(userAnswer);
                } else if (question.type === 'checkbox') {
                    const userAnswersArray = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
                    isCorrect = JSON.stringify(userAnswersArray.sort()) === JSON.stringify(question.correctAnswers.sort());
                } else {
                   
                    isCorrect = false;
                }
                
                marksObtained = isCorrect ? question.marks : 0;
                totalMarksObtained += marksObtained;
            }
            
            detailedAnswers.push({
                question: question._id,
                answer: userAnswer,
                isCorrect,
                marksObtained
            });
        });
        
        const percentage = (totalMarksObtained / exam.totalMarks) * 100;
        const passed = percentage >= exam.passingMarks;
        
        
        let result = await Result.findOneAndUpdate(
            {
                user: userId,
                exam: examId
            },
            {
                answers: detailedAnswers,
                totalMarksObtained,
                percentage,
                status: 'completed',
                submittedAt: new Date(),
                timeTaken,
                progress: null 
            },
            { new: true, upsert: true }
        ).populate('exam', 'title totalMarks passingMarks');
        
        res.json({
            success: true,
            results: {
                score: percentage,
                totalMarks: exam.totalMarks,
                obtainedMarks: totalMarksObtained,
                passingMarks: exam.passingMarks,
                passed,
                timeTaken,
                submittedAt: result.submittedAt
            }
        });
        
    } catch (error) {
        console.error('Submit exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting exam'
        });
    }
};