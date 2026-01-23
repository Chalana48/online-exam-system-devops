let results = [];
let resultId = 1;

class Result {
    constructor(data) {
        this._id = resultId++;
        this.user = data.user || null;
        this.exam = data.exam || null;
        this.answers = data.answers || [];
        this.totalMarksObtained = data.totalMarksObtained || 0;
        this.percentage = data.percentage || 0;
        this.status = data.status || 'in_progress';
        this.startedAt = data.startedAt || new Date();
        this.submittedAt = data.submittedAt || null;
        this.timeTaken = data.timeTaken || 0;
        this.progress = data.progress || {
            currentQuestion: 0,
            userAnswers: {},
            markedQuestions: [],
            timeRemaining: 0
        };
        this.createdAt = new Date();
    }

    static async create(data) {
        const result = new Result(data);
        results.push(result);
        return result;
    }

    static async find(query = {}) {
        let result = [...results];
        
        if (query.user) {
            result = result.filter(r => r.user == query.user);
        }
        if (query.exam) {
            result = result.filter(r => r.exam == query.exam);
        }
        if (query.status) {
            result = result.filter(r => r.status === query.status);
        }
        
        return result;
    }

    static async findOne(query) {
        const found = results.find(r => {
            if (query.user && r.user != query.user) return false;
            if (query.exam && r.exam != query.exam) return false;
            if (query.status && !query.status.$in?.includes(r.status)) return false;
            return true;
        });
        return found || null;
    }

    static async countDocuments(query = {}) {
        return results.filter(r => {
            if (query.user && r.user != query.user) return false;
            if (query.exam && r.exam != query.exam) return false;
            if (query.status && r.status !== query.status) return false;
            return true;
        }).length;
    }

    async save() {
        const index = results.findIndex(r => r._id === this._id);
        if (index === -1) {
            results.push(this);
        } else {
            results[index] = this;
        }
        return this;
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const index = results.findIndex(r => r._id == id);
        if (index === -1 && options.upsert) {
            const newResult = new Result(update);
            results.push(newResult);
            return newResult;
        } else if (index !== -1) {
            Object.assign(results[index], update);
            return results[index];
        }
        return null;
    }
}

module.exports = Result;