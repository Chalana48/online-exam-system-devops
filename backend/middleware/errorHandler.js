const errorHandler = (err, req, res, next) => {
    console.error(err.stack); 
 
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode; 
    let message = err.message; 
 
    if (err.name === 'JsonWebTokenError') { 
        statusCode = 401; 
        message = 'Invalid token'; 
    } 
 
    if (err.name === 'TokenExpiredError') { 
        statusCode = 401; 
        message = 'Token expired'; 
    } 
 
    res.status(statusCode).json({ 
        success: false, 
        message, 
        stack: process.env.NODE_ENV === 'production' ? '??' : err.stack 
    }); 
}; 
 
module.exports = errorHandler; 
