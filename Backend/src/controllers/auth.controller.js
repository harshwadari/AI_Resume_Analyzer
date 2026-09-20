const bcrypt = require('bcrypt');
const dummyPasswordHash = bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 10);
const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { generateResetToken, hashToken } = require("../utils/otp.utils");
const { sendResetPasswordEmail, sendGoogleAuthReminderEmail, sendContactEmail } = require("../services/email.service");

const { cookieOptions: getCookieOptions, authConfig } = require('../config/auth.config');

// ── Helper: Generate JWT and set it as an httpOnly cookie ──
const signTokenAndSetCookie = (user, res, authMethod = "password") => {
    const token = jwt.sign(
        { id: String(user._id), tokenVersion: user.tokenVersion || 0, authMethod, authTime: Math.floor(Date.now() / 1000) },
        process.env.JWT_SECRET,
        { expiresIn: "1d", algorithm: 'HS256', jwtid: require('crypto').randomUUID(), issuer: 'prepwise', audience: 'prepwise-web' }
    );

    res.cookie("token", token, getCookieOptions());

};

const { issueOtp: createAndSendVerificationOtp, consumeOtp } = require('../services/verification.service');

const isEmailServiceConfigured = () => {
    return require('../config/email.config').emailConfigured(process.env);
};

const registerUserController = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    const duplicateMessage = "A user with this username or email already exists. Please sign in or recover your password.";
    const existing = await userModel.findOne({ $or: [{ email }, { username }] }).select('_id');
    if (existing) throw new AppError(duplicateMessage, 409);
    if (!isEmailServiceConfigured()) throw new AppError("Email service is temporarily unavailable", 503);
    let user;
    try {
        user = await userModel.create({ username, email, password });
    } catch (err) {
        // Unique indexes also protect concurrent registrations after the lookup.
        if (err.code === 11000) throw new AppError(duplicateMessage, 409);
        throw err;
    }
    try {
        await createAndSendVerificationOtp(user);
    } catch (err) {
        if (err.statusCode !== 503) throw err;
        throw new AppError('Your account is pending verification, but the email could not be sent. Please sign in to retry verification shortly.', 503);
    }
    return res.status(200).json({
        success: true,
        requiresVerification: true,
        email,
        message: "If verification is needed, a code will be sent. Otherwise, sign in or recover your password.",
    });
});

const verifyOtpController = asyncHandler(async (req, res) => {
    const user = await consumeOtp(req.body.email, req.body.otp);
    if (!user) throw new AppError("Invalid or expired code. Request a new code if needed.", 400);
    signTokenAndSetCookie(user, res, "otp");
    return res.status(200).json({ success: true, message: "Email verified successfully", user: { id: user._id, username: user.username, email: user.email } });
});

const resendOtpController = asyncHandler(async (req, res) => {
    const user = await userModel.findOne({ email: req.body.email });
    if (user && !user.isVerified && user.password) await createAndSendVerificationOtp(user);
    return res.status(200).json({ success: true, message: "If verification is needed and the cooldown has passed, a code will be sent." });
});

const loginUserController = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });

    const isPasswordValid = await bcrypt.compare(password, user?.password || await dummyPasswordHash);
    if (!user?.password || !isPasswordValid) throw new AppError("Invalid email or password", 400);

    // Block login if email is not verified
    if (!user.isVerified) {
        try {
            await createAndSendVerificationOtp(user);
        } catch (err) {
            if (err.statusCode !== 503) throw err;
            return res.status(503).json({ success: false, requiresVerification: true, email: user.email,
                message: 'Verification email could not be sent. Please retry sending your code shortly.' });
        }

        return res.status(403).json({
            success: false,
            message: "Email verification is required. Enter your code or request a new one.",
            requiresVerification: true,
            email: user.email,
        });
    }

    signTokenAndSetCookie(user, res);

    return res.status(200).json({
        success: true,
        message: "User logged in successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
        }
    });
});

const logoutUserController = asyncHandler(async (req, res) => {
    let decoded;
    try {
        decoded = jwt.verify(req.cookies?.token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'prepwise', audience: 'prepwise-web' });
    } catch {
        // Missing/expired/malformed cookies are already unauthenticated.
    }
    try {
        if (decoded && require('mongoose').isValidObjectId(decoded.id) && Number.isInteger(decoded.tokenVersion)) {
            const versionFilter = decoded.tokenVersion === 0 ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] } : { tokenVersion: decoded.tokenVersion };
            await userModel.updateOne({ _id: decoded.id, ...versionFilter }, { $inc: { tokenVersion: 1 } });
        }
    } catch {
        throw new AppError('Browser signed out, but session revocation could not be confirmed. Please try again when the service is available.', 503);
    } finally {
        require('../config/auth.config').clearAuthCookie(res);
    }
    return res.status(200).json({ success: true, message: 'Signed out of all sessions' });
});

const getMeController = asyncHandler(async (req, res) => {
    const user = await userModel.findById(req.user.id).select("_id username email");

    if (!user) {
        throw new AppError("User not found", 404);
    }

    res.status(200).json({
        success: true,
        message: "User details fetched successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
        }
    });
});

const forgotPasswordController = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!isEmailServiceConfigured()) throw new AppError("Email service is temporarily unavailable", 503);
    const reply = () => res.status(200).json({ success: true, message: "If the account is eligible, recovery instructions will be sent. Google-only accounts should sign in with Google." });
    const user = await userModel.findOne({ email });
    if (!user) return reply();
    const eligible = await userModel.findOneAndUpdate({
        _id: user._id,
        $or: [{ resetPasswordRequestedAt: null }, { resetPasswordRequestedAt: { $lte: new Date(Date.now() - 60_000) } }],
    }, { $set: { resetPasswordRequestedAt: new Date() } }, { returnDocument: 'after' });
    if (!eligible) return reply();
    if (!eligible.password) {
        try { await sendGoogleAuthReminderEmail(email); } catch { console.error('Google sign-in reminder delivery failed'); }
        return reply();
    }
    const rawToken = generateResetToken();
    const hash = hashToken(rawToken);
    await userModel.updateOne({ _id: user._id }, { $set: { resetPasswordToken: hash, resetPasswordExpiry: new Date(Date.now() + 15 * 60_000) } });
    try {
        await sendResetPasswordEmail(email, authConfig().frontend + '/reset-password/' + rawToken);
    } catch {
        await userModel.updateOne({ _id: user._id, resetPasswordToken: hash }, { $set: { resetPasswordToken: null, resetPasswordExpiry: null } });
        console.error('Password reset email delivery failed');
    }
    return reply();
});

const resetPasswordController = asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    // Query updates do not execute the save hook: hash explicitly once here.
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userModel.findOneAndUpdate({
        resetPasswordToken: hashToken(token), resetPasswordExpiry: { $gt: new Date() },
        password: { $type: 'string', $ne: '' },
    }, {
        $set: { password: passwordHash, resetPasswordToken: null, resetPasswordExpiry: null },
        $inc: { tokenVersion: 1 },
    }, { returnDocument: 'after' });
    if (!user) throw new AppError("Invalid or expired reset token. Please request a new one.", 400);
    require('../config/auth.config').clearAuthCookie(res);
    return res.status(200).json({ success: true, message: "Password reset successful. Please login with your new password." });
});

const googleAuthCallbackController = asyncHandler(async (req, res) => {
    const frontend = authConfig().frontend;
    if (!req.user) return res.redirect(frontend + '/login?error=google_auth_failed');
    signTokenAndSetCookie(req.user, res, 'google');
    return res.redirect(frontend + '/workspace');
});

const contactController = asyncHandler(async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        throw new AppError("Please provide name, email and message", 400);
    }

    await sendContactEmail(name, email, message);

    return res.status(200).json({
        success: true,
        message: "Your message has been sent successfully. We will get back to you soon!",
    });
});

const reauthenticateController = asyncHandler(async (req, res) => {
    const user = await userModel.findById(req.user.id);
    const valid = await bcrypt.compare(req.body.password, user?.password || await dummyPasswordHash);
    if (!user?.password || !user.isVerified || !valid) throw new AppError("Unable to confirm password", 400);
    signTokenAndSetCookie(user, res);
    res.json({ success: true });
});

const deleteAccountController = asyncHandler(async (req, res) => {
    if (req.body?.confirmation !== 'DELETE') throw new AppError('Type DELETE to confirm permanent account deletion.', 400);
    // The target always comes from the verified cookie, never a request-body ID.
    await require('../services/account.service').deleteAccount(req.user.id);
    require('../config/auth.config').clearAuthCookie(res);
    res.json({ success: true, message: 'Your account and saved reports have been permanently deleted.' });
});

module.exports = {
    deleteAccountController,
    reauthenticateController,
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController,
    verifyOtpController,
    resendOtpController,
    forgotPasswordController,
    resetPasswordController,
    googleAuthCallbackController,
    contactController,
};
