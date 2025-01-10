// errorHandlerMiddleware.js
const errorHandlerMiddleware = (err, req, res, next) => {
    // Determine the status code (use 500 if no status code is set)
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);

    // Return a JSON response with the error message
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === "production" ? null : err.stack, // Hide stack trace in production
    });
};

module.exports = errorHandlerMiddleware;