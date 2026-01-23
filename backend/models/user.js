let users = [];
let userId = 1;

class User {
    constructor(data) {
        this._id = userId++;
        this.fullName = data.fullName || '';
        this.email = data.email || '';
        this.username = data.username || '';
        this.password = data.password || '';
        this.role = data.role || 'student';
        this.status = data.status || 'active';
        this.studentId = data.studentId || '';
        this.phone = data.phone || '';
        this.createdAt = new Date();
    }


    static async create(data) {
        const user = new User(data);
        users.push(user);
        return user;
    }

    static async findOne(query) {
        if (query.$or) {
            for (const condition of query.$or) {
                if (condition.username) {
                    return users.find(u => u.username === condition.username);
                }
                if (condition.email) {
                    return users.find(u => u.email === condition.email);
                }
            }
        }
        return null;
    }

    static async findById(id) {
        return users.find(u => u._id == id);
    }

    static async countDocuments(query = {}) {
        if (Object.keys(query).length === 0) {
            return users.length;
        }
        return users.filter(u => {
            if (query.role && u.role !== query.role) return false;
            if (query.status && u.status !== query.status) return false;
            return true;
        }).length;
    }

    static async find(query = {}) {
        let result = [...users];
        
        if (query.role) {
            result = result.filter(u => u.role === query.role);
        }
        if (query.status) {
            result = result.filter(u => u.status === query.status);
        }
        
        return result;
    }

    async save() {
        const index = users.findIndex(u => u._id === this._id);
        if (index === -1) {
            users.push(this);
        } else {
            users[index] = this;
        }
        return this;
    }

    async comparePassword(password) {
        return this.password === password;
    }
}

module.exports = User;