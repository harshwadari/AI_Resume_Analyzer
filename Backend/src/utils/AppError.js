/**
 * AppError — Custom error class for operational errors.
 *
 * Usage:  throw new AppError("Email not found", 404)
 *
 * The global error handler in app.js checks `isOperational` to decide
 * whether to send the error message to the client or a generic 500.
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;

        // Captures the stack trace, excluding the constructor call itself
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
