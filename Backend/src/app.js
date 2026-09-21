const { authConfig } = require('./config/auth.config');
const { csrfGuard } = require('./middlewares/csrf.middleware');
const express = require('express');
const cookieParser = require("cookie-parser");
const multer = require("multer");
const helmet = require("helmet");
const authRouter = require("./Routes/auth.routes");
const interviewRouter = require("./Routes/interview.routes");
const recruiterRouter = require('./Routes/recruiter.routes');
const cors = require("cors");
const AppError = require("./utils/AppError");
const passport = require("passport");
require("./config/passport.config");

const app = express();
const allowedOrigins = [authConfig().frontend];
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));

// ── Security: Helmet sets various HTTP headers to protect against
// common attacks like XSS, clickjacking, MIME-type sniffing, etc. ──
app.use(helmet());
app.use(passport.initialize());

// Scope the larger JSON allowance to recruiter input. Existing APIs retain 32 KB.
// 20,000 characters can exceed 32 KB in UTF-8 or when JSON-escaped.
app.use('/api/recruiter', express.json({ limit: '128kb' }), (err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Job description request is too large.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Invalid JSON request.' });
    next(err);
});
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
            return callback(null, true);
        }

        return callback(new AppError("Not allowed by CORS", 403));
    },
    allowedHeaders: ["Content-Type", "X-Requested-With"],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true
}));

app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); }, csrfGuard);
app.use("/api/auth", authRouter);
app.use("/api/interview", interviewRouter);
app.use('/api/recruiter', recruiterRouter);

// ── Health check — ping this every 14 min via cron-job.org to keep Render warm ──
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

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

        return res.status(400).json({
            success: false,
            message: "Unable to complete the request with these details",
        });
    }

    // Unexpected errors — log for debugging, send generic message to client
    require('./utils/securityLog').logFailure('Request failed', err);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

module.exports = app;
