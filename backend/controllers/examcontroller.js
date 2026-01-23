const Exam = require('../models/exam');
const Question = require('../models/question');
const Result = require('../models/result');


exports.getExamWithQuestions = async (req, res) => {
    try {
        const examId = req.params.id;
        const userId = req.user.id;

        
        const exam = await Exam.findOne({
            _id: examId,
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            $or: [
                { allowedUsers: { $size: 0 } }, 
                { allowedUsers: userId } 
            ]
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found, not active, or you are not authorized'
            });
        }

        
        const attempts = await Result.countDocuments({
            user: userId,
            exam: examId,
            status: 'completed'
        });

        if (attempts >= exam.maxAttempts) {
            return res.status(403).json({
                success: false,
                message: `You have reached the maximum number of attempts (${exam.maxAttempts}) for this exam`
            });
        }

        
        const questions = await Question.find({ exam: examId })
            .select('-correctAnswers -explanation') 
            .sort('order');

        
        const existingResult = await Result.findOne({
            user: userId,
            exam: examId,
            status: { $in: ['in_progress', 'submitted'] }
        });

        
        let timeRemaining = exam.duration * 60; 
        if (existingResult && existingResult.progress?.timeRemaining) {
            timeRemaining = existingResult.progress.timeRemaining;
        }

        
        const examData = {
            exam: {
                _id: exam._id,
                title: exam.title,
                description: exam.description,
                duration: exam.duration,
                totalMarks: exam.totalMarks,
                passingMarks: exam.passingMarks,
                instructions: exam.instructions,
                startDate: exam.startDate,
                endDate: exam.endDate,
                maxAttempts: exam.maxAttempts,
                attemptsUsed: attempts
            },
            questions: questions.map(q => ({
                _id: q._id,
                text: q.text,
                type: q.type,
                options: q.options,
                marks: q.marks,
                difficulty: q.difficulty,
                order: q.order
            })),
            existingAttempt: existingResult ? {
                id: existingResult._id,
                status: existingResult.status,
                progress: existingResult.progress
            } : null,
            timeRemaining
        };

        res.json({
            success: true,
            exam: examData.exam,
            questions: examData.questions,
            existingAttempt: examData.existingAttempt,
            timeRemaining: examData.timeRemaining
        });

    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching exam details'
        });
    }
};


exports.startExam = async (req, res) => {
    try {
        const examId = req.params.id;
        const userId = req.user.id;

        
        const exam = await Exam.findOne({
            _id: examId,
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found or not active'
            });
        }

        
        const attempts = await Result.countDocuments({
            user: userId,
            exam: examId,
            status: 'completed'
        });

        if (attempts >= exam.maxAttempts) {
            return res.status(403).json({
                success: false,
                message: 'Maximum attempts reached for this exam'
            });
        }

       
        const existingResult = await Result.findOne({
            user: userId,
            exam: examId,
            status: { $in: ['in_progress', 'submitted'] }
        });

        if (existingResult) {
            return res.json({
                success: true,
                message: 'Resuming existing exam attempt',
                resultId: existingResult._id,
                status: existingResult.status,
                progress: existingResult.progress
            });
        }

        
        const result = await Result.create({
            user: userId,
            exam: examId,
            status: 'in_progress',
            startedAt: new Date(),
            progress: {
                currentQuestion: 0,
                userAnswers: {},
                timeRemaining: exam.duration * 60
            }
        });

        res.status(201).json({
            success: true,
            message: 'Exam started successfully',
            resultId: result._id,
            timeRemaining: exam.duration * 60
        });

    } catch (error) {
        console.error('Start exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting exam'
        });
    }
};


exports.getQuestion = async (req, res) => {
    try {
        const { examId, questionId } = req.params;
        const userId = req.user.id;

        
        const canAccess = await Exam.findOne({
            _id: examId,
            status: 'active',
            $or: [
                { allowedUsers: { $size: 0 } },
                { allowedUsers: userId }
            ]
        });

        if (!canAccess) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this exam'
            });
        }

       
        const question = await Question.findOne({
            _id: questionId,
            exam: examId
        }).select('-correctAnswers');

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }

        res.json({
            success: true,
            question
        });

    } catch (error) {
        console.error('Get question error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching question'
        });
    }
};


exports.saveAnswer = async (req, res) => {
    try {
        const { examId, questionId } = req.params;
        const userId = req.user.id;
        const { answer } = req.body;

        
        const result = await Result.findOne({
            user: userId,
            exam: examId,
            status: { $in: ['in_progress', 'submitted'] }
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No active exam session found'
            });
        }

        
        result.progress.userAnswers = result.progress.userAnswers || {};
        result.progress.userAnswers[questionId] = answer;
        
        await result.save();

        res.json({
            success: true,
            message: 'Answer saved successfully'
        });

    } catch (error) {
        console.error('Save answer error:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving answer'
        });
    }
};


exports.markQuestion = async (req, res) => {
    try {
        const { examId, questionId } = req.params;
        const userId = req.user.id;

        const result = await Result.findOne({
            user: userId,
            exam: examId,
            status: { $in: ['in_progress', 'submitted'] }
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No active exam session found'
            });
        }

        
        if (!result.progress.markedQuestions) {
            result.progress.markedQuestions = [];
        }

        
        const index = result.progress.markedQuestions.indexOf(questionId);
        if (index === -1) {
            result.progress.markedQuestions.push(questionId);
        } else {
            result.progress.markedQuestions.splice(index, 1);
        }

        await result.save();

        res.json({
            success: true,
            message: 'Question mark status updated',
            marked: index === -1 // true if newly marked, false if unmarked
        });

    } catch (error) {
        console.error('Mark question error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking question'
        });
    }
};


exports.clearAnswer = async (req, res) => {
    try {
        const { examId, questionId } = req.params;
        const userId = req.user.id;

        const result = await Result.findOne({
            user: userId,
            exam: examId,
            status: { $in: ['in_progress', 'submitted'] }
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No active exam session found'
            });
        }

       
        if (result.progress.userAnswers && result.progress.userAnswers[questionId]) {
            delete result.progress.userAnswers[questionId];
            await result.save();
        }

        res.json({
            success: true,
            message: 'Answer cleared successfully'
        });

    } catch (error) {
        console.error('Clear answer error:', error);
        res.status(500).json({
            success: false,
            message: 'Error clearing answer'
        });
    }
};


exports.getExamSummary = async (req, res) => {
    try {
        const examId = req.params.id;
        const userId = req.user.id;

        const result = await Result.findOne({
            user: userId,
            exam: examId,
            status: { $in: ['in_progress', 'submitted'] }
        }).populate('exam', 'title totalMarks duration');

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No exam session found'
            });
        }

        
        const questionCount = await Question.countDocuments({ exam: examId });

        
        const answeredCount = result.progress.userAnswers 
            ? Object.keys(result.progress.userAnswers).length 
            : 0;

        
        const markedCount = result.progress.markedQuestions 
            ? result.progress.markedQuestions.length 
            : 0;

        
        const timeUsed = result.timeTaken || 
            (result.startedAt ? Math.floor((new Date() - result.startedAt) / 1000) : 0);

        res.json({
            success: true,
            summary: {
                exam: result.exam,
                questionCount,
                answeredCount,
                unansweredCount: questionCount - answeredCount,
                markedCount,
                currentQuestion: result.progress.currentQuestion || 0,
                timeUsed,
                timeRemaining: result.progress.timeRemaining || 0,
                status: result.status
            }
        });

    } catch (error) {
        console.error('Get exam summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching exam summary'
        });
    }
};


exports.autoSubmitExam = async (req, res) => {
    try {
        const examId = req.params.id;
        const userId = req.user.id;

        
        const result = await Result.findOne({
            user: userId,
            exam: examId,
            status: 'in_progress'
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No active exam session found'
            });
        }

        
        const exam = await Exam.findById(examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        
        const timeTaken = result.timeTaken || 
            Math.floor((new Date() - result.startedAt) / 1000);

       
        const questions = await Question.find({ exam: examId });
        
        
        let totalMarksObtained = 0;
        const detailedAnswers = [];

        questions.forEach(question => {
            const userAnswer = result.progress.userAnswers 
                ? result.progress.userAnswers[question._id] 
                : null;
            
            let isCorrect = false;
            let marksObtained = 0;

            if (userAnswer) {
                if (question.type === 'mcq') {
                    isCorrect = question.correctAnswers.includes(userAnswer);
                } else if (question.type === 'checkbox') {
                    const userAnswersArray = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
                    isCorrect = JSON.stringify(userAnswersArray.sort()) === 
                               JSON.stringify(question.correctAnswers.sort());
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

        
        result.answers = detailedAnswers;
        result.totalMarksObtained = totalMarksObtained;
        result.percentage = percentage;
        result.status = 'completed';
        result.submittedAt = new Date();
        result.timeTaken = timeTaken;
        result.progress = null; 
        await result.save();

        res.json({
            success: true,
            message: 'Exam auto-submitted due to time expiration',
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
        console.error('Auto-submit error:', error);
        res.status(500).json({
            success: false,
            message: 'Error auto-submitting exam'
        });
    }
};


exports.getExamResults = async (req, res) => {
    try {
        const examId = req.params.id;
        const userId = req.user.id;

        const result = await Result.findOne({
            user: userId,
            exam: examId,
            status: 'completed'
        })
        .populate('exam', 'title description totalMarks passingMarks duration')
        .populate({
            path: 'answers.question',
            select: 'text type options marks explanation'
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No results found for this exam'
            });
        }

        
        const formattedResults = {
            exam: {
                id: result.exam._id,
                title: result.exam.title,
                description: result.exam.description,
                totalMarks: result.exam.totalMarks,
                passingMarks: result.exam.passingMarks,
                duration: result.exam.duration
            },
            score: {
                percentage: result.percentage,
                obtainedMarks: result.totalMarksObtained,
                totalMarks: result.exam.totalMarks,
                passed: result.percentage >= result.exam.passingMarks
            },
            timing: {
                startedAt: result.startedAt,
                submittedAt: result.submittedAt,
                timeTaken: result.timeTaken
            },
            answers: result.answers.map(answer => ({
                question: {
                    id: answer.question._id,
                    text: answer.question.text,
                    type: answer.question.type,
                    options: answer.question.options,
                    marks: answer.question.marks,
                    explanation: answer.question.explanation
                },
                userAnswer: answer.answer,
                isCorrect: answer.isCorrect,
                marksObtained: answer.marksObtained
            })),
            statistics: {
                totalQuestions: result.answers.length,
                correctAnswers: result.answers.filter(a => a.isCorrect).length,
                incorrectAnswers: result.answers.filter(a => !a.isCorrect && a.answer).length,
                unattempted: result.answers.filter(a => !a.answer).length
            }
        };

        res.json({
            success: true,
            results: formattedResults
        });

    } catch (error) {
        console.error('Get exam results error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching exam results'
        });
    }
};


exports.getAllExams = async (req, res) => {
    try {
       
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin/Teacher only.'
            });
        }

        const { status, search, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const query = {};

        
        if (status && status !== 'all') {
            query.status = status;
        }

        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        
        if (req.user.role === 'teacher') {
            query.createdBy = req.user.id;
        }

        
        const exams = await Exam.find(query)
            .populate('createdBy', 'username fullName')
            .populate('questions')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        
        const total = await Exam.countDocuments(query);

        
        const examsWithStats = await Promise.all(exams.map(async (exam) => {
            const participantCount = await Result.countDocuments({ exam: exam._id });
            const completedCount = await Result.countDocuments({ 
                exam: exam._id, 
                status: 'completed' 
            });
            const averageScore = await Result.aggregate([
                { $match: { exam: exam._id, status: 'completed' } },
                { $group: { _id: null, avgScore: { $avg: '$percentage' } } }
            ]);

            return {
                ...exam.toObject(),
                participantCount,
                completedCount,
                averageScore: averageScore[0]?.avgScore || 0
            };
        }));

        res.json({
            success: true,
            exams: examsWithStats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get all exams error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching exams'
        });
    }
};


exports.createExam = async (req, res) => {
    try {
        
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin/Teacher only.'
            });
        }

        const {
            title,
            description,
            duration,
            totalMarks,
            passingMarks,
            instructions,
            startDate,
            endDate,
            maxAttempts,
            allowedUsers,
            status,
            questions
        } = req.body;

        // Create exam
        const exam = new Exam({
            title,
            description,
            duration,
            totalMarks,
            passingMarks,
            instructions,
            startDate,
            endDate,
            maxAttempts: maxAttempts || 1,
            allowedUsers: allowedUsers || [],
            createdBy: req.user.id,
            status: status || 'draft'
        });

        await exam.save();

        
        if (questions && Array.isArray(questions)) {
            const questionPromises = questions.map(async (q, index) => {
                const question = new Question({
                    exam: exam._id,
                    text: q.text,
                    type: q.type,
                    options: q.options,
                    correctAnswers: q.correctAnswers,
                    marks: q.marks || 1,
                    explanation: q.explanation,
                    difficulty: q.difficulty || 'medium',
                    order: index
                });
                return question.save();
            });

            const createdQuestions = await Promise.all(questionPromises);
            exam.questions = createdQuestions.map(q => q._id);
            await exam.save();
        }

        res.status(201).json({
            success: true,
            exam,
            message: 'Exam created successfully'
        });

    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating exam'
        });
    }
};


exports.updateExam = async (req, res) => {
    try {
        const examId = req.params.id;

        
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin/Teacher only.'
            });
        }

        
        const exam = await Exam.findById(examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        
        if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own exams'
            });
        }

       
        const updatedExam = await Exam.findByIdAndUpdate(
            examId,
            req.body,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            exam: updatedExam,
            message: 'Exam updated successfully'
        });

    } catch (error) {
        console.error('Update exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating exam'
        });
    }
};


exports.deleteExam = async (req, res) => {
    try {
        const examId = req.params.id;

        
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }

        
        const exam = await Exam.findById(examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

       
        const resultsCount = await Result.countDocuments({ exam: examId });
        if (resultsCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete exam with existing results. Archive it instead.'
            });
        }

        
        await Question.deleteMany({ exam: examId });

        
        await Exam.findByIdAndDelete(examId);

        res.json({
            success: true,
            message: 'Exam deleted successfully'
        });

    } catch (error) {
        console.error('Delete exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting exam'
        });
    }
};


exports.addQuestion = async (req, res) => {
    try {
        const examId = req.params.id;

        
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin/Teacher only.'
            });
        }

        
        const exam = await Exam.findById(examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        
        if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only add questions to your own exams'
            });
        }

        const { text, type, options, correctAnswers, marks, explanation, difficulty } = req.body;

        
        const question = new Question({
            exam: examId,
            text,
            type,
            options,
            correctAnswers,
            marks: marks || 1,
            explanation,
            difficulty: difficulty || 'medium',
            order: exam.questions.length 
        });

        await question.save();

        
        exam.questions.push(question._id);
        await exam.save();

        res.status(201).json({
            success: true,
            question,
            message: 'Question added successfully'
        });

    } catch (error) {
        console.error('Add question error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding question'
        });
    }
};


exports.getAllQuestions = async (req, res) => {
    try {
        const examId = req.params.id;

    
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin/Teacher only.'
            });
        }

        
        const exam = await Exam.findById(examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        
        if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only view questions for your own exams'
            });
        }

        
        const questions = await Question.find({ exam: examId }).sort('order');

        res.json({
            success: true,
            questions
        });

    } catch (error) {
        console.error('Get all questions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching questions'
        });
    }
};