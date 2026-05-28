const express = require('express');
const cookieParser = require("cookie-parser");
const multer = require("multer");
const helmet = require("helmet");
const authRouter = require("./Routes/auth.routes");
const interviewRouter = require("./Routes/interview.routes");
const cors = require("cors");
const AppError = require("./utils/AppError");
const passport = require("passport");
require("./config/passport.config");

const app = express();

// ── Security: Helmet sets various HTTP headers to protect against
// common attacks like XSS, clickjacking, MIME-type sniffing, etc. ──
app.use(helmet());
app.use(passport.initialize());

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://ai-resume-analyzer-qptge9vwi-harshwadaris-projects.vercel.app"
    ],
    credentials: true
}));

app.use("/api/auth", authRouter);
app.use("/api/interview", interviewRouter);

//  Global error handler — must be after all routes
app.use((err, req, res, next) => {
    // Handle Multer-specific errors (file upload issues)
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: `Multer error: ${err.message}`,
            field: err.field  // tells you exactly which field caused the issue
        });
    }

    // Handle our custom AppError (operational errors we expect)
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
    }

    // Handle Mongoose validation errors (e.g. duplicate key, schema validation)
    if (err.name === "ValidationError") {
        const firstError = Object.values(err.errors)[0];
        return res.status(400).json({
            success: false,
            message: firstError.message,
        });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            success: false,
            message: `An account with this ${field} already exists`,
        });
    }

    // Unexpected errors — log for debugging, send generic message to client
    console.error("Unhandled error:", err);
    return res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message || "Internal server error"
    });
});

module.exports = app;