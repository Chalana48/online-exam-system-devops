let exams = [];
let examId = 1;

class Exam {
    constructor(data) {
        this._id = examId++;
        this.title = data.title || '';
        this.description = data.description || '';
        this.duration = data.duration || 30;
        this.totalMarks = data.totalMarks || 100;
        this.passingMarks = data.passingMarks || 40;
        this.instructions = data.instructions || '';
        this.status = data.status || 'draft';
        this.startDate = data.startDate || new Date();
        this.endDate = data.endDate || new Date(Date.now() + 30*24*60*60*1000);
        this.createdBy = data.createdBy || null;
        this.questions = data.questions || [];
        this.allowedUsers = data.allowedUsers || [];
        this.maxAttempts = data.maxAttempts || 1;
        this.createdAt = new Date();
    }

    static async create(data) {
        const exam = new Exam(data);
        exams.push(exam);
        return exam;
    }

    static async find(query = {}) {
        let result = [...exams];
        
        if (query.status) {
            result = result.filter(e => e.status === query.status);
        }
        if (query._id) {
            result = result.filter(e => e._id == query._id);
        }
        
        return result;
    }

    static async findById(id) {
        return exams.find(e => e._id == id);
    }

    static async countDocuments(query = {}) {
        if (Object.keys(query).length === 0) {
            return exams.length;
        }
        return exams.filter(e => {
            if (query.status && e.status !== query.status) return false;
            return true;
        }).length;
    }

    async save() {
        const index = exams.findIndex(e => e._id === this._id);
        if (index === -1) {
            exams.push(this);
        } else {
            exams[index] = this;
        }
        return this;
    }

    static async findOne(query) {
        if (query._id) {
            return exams.find(e => e._id == query._id);
        }
        if (query.title) {
            return exams.find(e => e.title === query.title);
        }
        return null;
    }
}

module.exports = Exam;