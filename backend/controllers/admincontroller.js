const User = require('../models/user');
const Exam = require('../models/exam');
const Result = require('../models/result');

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/stats
exports.getAdminStats = async (req, res) => {
    try {
        // Only admin can access
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }
        
        // Get total users
        const totalUsers = await User.countDocuments();
        
        // Get new users this week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const newUsers = await User.countDocuments({
            createdAt: { $gte: oneWeekAgo }
        });
        
        // Get total active exams
        const totalExams = await Exam.countDocuments({ status: 'active' });
        
        // Get ongoing exams (started but not ended)
        const activeExamsCount = await Exam.countDocuments({
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });
        
        // Get total completed tests
        const completedTests = await Result.countDocuments({ status: 'completed' });
        
        // Get tests completed today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTests = await Result.countDocuments({
            submittedAt: { $gte: today },
            status: 'completed'
        });
        
        // Get pending actions (exams needing grading, user approvals, etc.)
        const textQuestionsCount = await require('../models/question').countDocuments({
            type: 'text'
        });
        const pendingActions = textQuestionsCount; // Example: text questions need manual grading
        
        res.json({
            success: true,
            stats: {
                totalUsers,
                newUsers,
                totalExams,
                activeExamsCount,
                completedTests,
                todayTests,
                pendingActions,
                urgentActions: 0 // You can implement logic for urgent actions
            }
        });
        
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching admin statistics'
        });
    }
};

// @desc    Get all users with pagination and filters
// @route   GET /api/admin/users
exports.getUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }
        
        const { page = 1, limit = 20, search = '', role = '', status = '' } = req.query;
        const skip = (page - 1) * limit;
        
        // Build query
        const query = {};
        
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { studentId: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (role && role !== 'all') {
            query.role = role;
        }
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        // Get users
        const users = await User.find(query)
            .select('-password')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });
        
        // Get total count for pagination
        const total = await User.countDocuments(query);
        
        res.json({
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users'
        });
    }
};

// @desc    Create new exam
// @route   POST /api/admin/exams
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
            allowedUsers
        } = req.body;
        
        const exam = await Exam.create({
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
            status: 'draft'
        });
        
        res.status(201).json({
            success: true,
            exam
        });
        
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating exam'
        });
    }
};

// @desc    Get all exams for admin
// @route   GET /api/admin/exams
exports.getExams = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin/Teacher only.'
            });
        }
        
        const { status = '', search = '' } = req.query;
        
        const query = {};
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }
        
        const exams = await Exam.find(query)
            .populate('createdBy', 'username fullName')
            .populate('questions')
            .populate('allowedUsers', 'username fullName')
            .sort({ createdAt: -1 });
        
        // Get participant counts for each exam
        const examsWithStats = await Promise.all(exams.map(async (exam) => {
            const participantCount = await Result.countDocuments({ exam: exam._id });
            const completedCount = await Result.countDocuments({ 
                exam: exam._id, 
                status: 'completed' 
            });
            
            return {
                ...exam.toObject(),
                participantCount,
                completedCount
            };
        }));
        
        res.json({
            success: true,
            exams: examsWithStats
        });
        
    } catch (error) {
        console.error('Get exams error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching exams'
        });
    }
};

// @desc    Get exam results analysis
// @route   GET /api/admin/results/:examId
exports.getExamResults = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin/Teacher only.'
            });
        }
        
        const { examId } = req.params;
        const { dateFrom, dateTo } = req.query;
        
        const query = { 
            exam: examId, 
            status: 'completed' 
        };
        
        if (dateFrom && dateTo) {
            query.submittedAt = {
                $gte: new Date(dateFrom),
                $lte: new Date(dateTo)
            };
        }
        
        const results = await Result.find(query)
            .populate('user', 'fullName username email')
            .populate('exam', 'title totalMarks passingMarks')
            .sort({ percentage: -1 });
        
        // Calculate statistics
        const scores = results.map(r => r.percentage);
        const averageScore = scores.length > 0 
            ? scores.reduce((a, b) => a + b, 0) / scores.length 
            : 0;
        
        const passedCount = results.filter(r => r.percentage >= r.exam.passingMarks).length;
        const failedCount = results.length - passedCount;
        
        // Score distribution
        const distribution = {
            excellent: scores.filter(s => s >= 90).length,
            good: scores.filter(s => s >= 70 && s < 90).length,
            average: scores.filter(s => s >= 50 && s < 70).length,
            poor: scores.filter(s => s < 50).length
        };
        
        res.json({
            success: true,
            results: results.map(r => ({
                id: r._id,
                user: r.user,
                score: r.percentage,
                marksObtained: r.totalMarksObtained,
                totalMarks: r.exam.totalMarks,
                timeTaken: r.timeTaken,
                submittedAt: r.submittedAt,
                rank: 0 // You can calculate rank based on percentage
            })),
            statistics: {
                totalParticipants: results.length,
                averageScore: Math.round(averageScore * 100) / 100,
                passedCount,
                failedCount,
                passRate: results.length > 0 ? (passedCount / results.length) * 100 : 0,
                distribution
            }
        });
        
    } catch (error) {
        console.error('Get exam results error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching exam results'
        });
    }
};

// @desc    Update user status
// @route   PUT /api/admin/users/:userId
exports.updateUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }
        
        const { userId } = req.params;
        const { status, role } = req.body;
        
        const updateData = {};
        if (status) updateData.status = status;
        if (role) updateData.role = role;
        
        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user,
            message: 'User updated successfully'
        });
        
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user'
        });
    }
};

// @desc    Get recent activity
// @route   GET /api/admin/activity
exports.getActivity = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }
        
        // Get recent user registrations
        const recentUsers = await User.find()
            .select('fullName username role createdAt')
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Get recent exam submissions
        const recentResults = await Result.find({ status: 'completed' })
            .populate('user', 'fullName username')
            .populate('exam', 'title')
            .sort({ submittedAt: -1 })
            .limit(10);
        
        // Combine activities
        const activities = [
            ...recentUsers.map(user => ({
                type: 'user_registration',
                user: user.fullName,
                role: user.role,
                timestamp: user.createdAt,
                message: `${user.fullName} (${user.role}) registered`
            })),
            ...recentResults.map(result => ({
                type: 'exam_submission',
                user: result.user.fullName,
                exam: result.exam.title,
                score: result.percentage,
                timestamp: result.submittedAt,
                message: `${result.user.fullName} completed ${result.exam.title} with ${result.percentage}%`
            }))
        ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
        
        res.json({
            success: true,
            activities
        });
        
    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity'
        });
    }
};