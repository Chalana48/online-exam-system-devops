const connectDB = async () => {
    console.log('✅ Using in-memory database for testing');
    console.log('⚠️ Note: Data will be lost when server restarts');
    return Promise.resolve();
};

module.exports = connectDB;