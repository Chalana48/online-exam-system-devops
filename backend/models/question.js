let questions = [];
let questionId = 1;

class Question {
    constructor(data) {
        this._id = questionId++;
        this.exam = data.exam || null;
        this.text = data.text || '';
        this.type = data.type || 'mcq';
        this.options = data.options || [];
        this.correctAnswers = data.correctAnswers || [];
        this.marks = data.marks || 1;
        this.explanation = data.explanation || '';
        this.difficulty = data.difficulty || 'medium';
        this.order = data.order || 0;
        this.createdAt = new Date();
    }

    static async create(data) {
        const question = new Question(data);
        questions.push(question);
        return question;
    }

    static async find(query = {}) {
        let result = [...questions];
        
        if (query.exam) {
            result = result.filter(q => q.exam == query.exam);
        }
        
        
        result.sort((a, b) => a.order - b.order);
        return result;
    }

    static async countDocuments(query = {}) {
        if (query.exam) {
            return questions.filter(q => q.exam == query.exam).length;
        }
        return questions.length;
    }

    static async insertMany(dataArray) {
        const created = dataArray.map(data => new Question(data));
        questions.push(...created);
        return created;
    }

    static async deleteMany(query = {}) {
        if (query.exam) {
            questions = questions.filter(q => q.exam != query.exam);
        }
        return { deletedCount: questions.length };
    }
}

module.exports = Question;