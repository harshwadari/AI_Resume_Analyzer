const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const tokenBlackListModel = require("../models/blacklist.model");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { generateOtp, generateResetToken, hashToken } = require("../utils/otp.utils");
const { sendOtpEmail, sendResetPasswordEmail, sendGoogleAuthReminderEmail, sendContactEmail } = require("../services/email.service");


// ── Helper: Cookie options for JWT tokens ──
// httpOnly prevents JavaScript access (XSS protection)
// secure ensures cookies are sent over HTTPS only in production
// sameSite prevents CSRF attacks
const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    };
};


// ── Helper: Generate JWT and set it as an httpOnly cookie ──
const signTokenAndSetCookie = (user, res) => {
    const token = jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    res.cookie("token", token, getCookieOptions());
    return token;
};

const createAndSendVerificationOtp = async (user) => {
    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    await sendOtpEmail(user.email, otp);
};


/**
 * @route POST /api/auth/register
 * @description Register a new user and send OTP to their email.
 *              User must verify OTP before they can login.
 * @access Public
 */
const registerUserController = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new AppError("Backend email service is not configured. Please ensure EMAIL_USER and EMAIL_PASS environment variables are set in the backend configuration.", 500);
    }

    if (!username || !email || !password) {
        throw new AppError("Please provide username, email and password", 400);
    }

    const existingEmailUser = await userModel.findOne({ email });
    const existingUsernameUser = await userModel.findOne({ username });

    if (existingUsernameUser && (!existingEmailUser || !existingUsernameUser._id.equals(existingEmailUser._id))) {
        throw new AppError("Account already exists with this username", 400);
    }

    if (existingEmailUser) {
        const canRefreshUnverifiedSignup = !existingEmailUser.isVerified
            && existingEmailUser.authProvider === "local";

        if (!canRefreshUnverifiedSignup) {
            throw new AppError("Account already exists with this email", 400);
        }

        existingEmailUser.username = username;
        existingEmailUser.password = password;

        try {
            await createAndSendVerificationOtp(existingEmailUser);
        } catch (emailError) {
            console.error("Failed to send verification email on registration retry:", emailError);
            throw new AppError("Failed to send verification email. Please check your email address or try again.", 500);
        }

        return res.status(200).json({
            success: true,
            message: "A new OTP has been sent to your email. Please verify to continue.",
            requiresVerification: true,
            email: existingEmailUser.email,
            user: {
                id: existingEmailUser._id,
                username: existingEmailUser.username,
                email: existingEmailUser.email,
            }
        });
    }

    // Create user (password hashed automatically by pre-save hook)
    const user = await userModel.create({
        username,
        email,
        password,
    });

    try {
        await createAndSendVerificationOtp(user);
    } catch (emailError) {
        // If sending email fails, delete the created user so they can try again,
        // and throw a clean error.
        await userModel.findByIdAndDelete(user._id);
        console.error("Failed to send verification email on registration:", emailError);
        throw new AppError("Failed to send verification email. Please check your email address or try again.", 500);
    }

    return res.status(201).json({
        success: true,
        message: "Registration successful. OTP sent to your email. Please verify to continue.",
        requiresVerification: true,
        email: user.email,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
        }
    });
});


/**
 * @route POST /api/auth/verify-otp
 * @description Verify the OTP sent to user's email during registration.
 *              On success, marks user as verified and issues JWT.
 * @access Public
 */
const verifyOtpController = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        throw new AppError("Please provide email and OTP", 400);
    }

    const user = await userModel.findOne({ email });

    if (!user) {
        throw new AppError("No account found with this email", 404);
    }

    if (user.isVerified) {
        throw new AppError("Email is already verified. Please login.", 400);
    }

    // Check if OTP matches
    if (user.otp !== otp) {
        throw new AppError("Invalid OTP. Please try again.", 400);
    }

    // Check if OTP has expired (5-minute window)
    if (user.otpExpiry < new Date()) {
        throw new AppError("OTP has expired. Please request a new one.", 400);
    }

    // Mark user as verified and clear OTP fields
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    // Issue JWT token and set cookie
    const token = signTokenAndSetCookie(user, res);

    return res.status(200).json({
        success: true,
        message: "Email verified successfully",
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
        }
    });
});


/**
 * @route POST /api/auth/resend-otp
 * @description Resend a new OTP to the user's email.
 *              Generates a fresh OTP with a new 5-minute expiry.
 * @access Public
 */
const resendOtpController = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new AppError("Please provide email", 400);
    }

    const user = await userModel.findOne({ email });

    if (!user) {
        throw new AppError("No account found with this email", 404);
    }

    if (user.isVerified) {
        throw new AppError("Email is already verified. Please login.", 400);
    }

    // Generate new OTP and reset expiry
    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    try {
        await sendOtpEmail(email, otp);
    } catch (emailError) {
        console.error("Failed to resend OTP email:", emailError);
        throw new AppError("Failed to resend verification email. Please try again later.", 500);
    }

    return res.status(200).json({
        success: true,
        message: "New OTP sent to your email",
    });
});


/**
 * @route POST /api/auth/login
 * @description Login a user with email and password.
 *              Blocks login if email is not verified.
 * @access Public
 */
const loginUserController = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });

    if (!user) {
        throw new AppError("Invalid email or password", 400);
    }

    // Block Google OAuth users from logging in with password
    if (user.authProvider === "google") {
        throw new AppError("This account uses Google login. Please sign in with Google.", 400);
    }

    // Use the instance method defined on the model
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
        throw new AppError("Invalid email or password", 400);
    }

    // Block login if email is not verified
    if (!user.isVerified) {
        try {
            await createAndSendVerificationOtp(user);
        } catch (emailError) {
            console.error("Failed to send verification email on login:", emailError);
            throw new AppError("Email not verified. We attempted to send a new OTP, but the email service failed. Please try again later.", 500);
        }

        return res.status(403).json({
            success: false,
            message: "Email not verified. A new OTP has been sent to your email.",
            requiresVerification: true,
            email: user.email,
        });
    }

    const token = signTokenAndSetCookie(user, res);

    return res.status(200).json({
        success: true,
        message: "User logged in successfully",
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
        }
    });
});


/**
 * @route GET /api/auth/logout
 * @description Logout a user by blacklisting their JWT token.
 * @access Public
 */
const logoutUserController = asyncHandler(async (req, res) => {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (token) {
        await tokenBlackListModel.create({ token });
    }

    res.clearCookie("token", getCookieOptions());

    return res.status(200).json({
        success: true,
        message: "User logged out successfully"
    });
});


/**
 * @route GET /api/auth/get-me
 * @description Get the details of the currently logged-in user.
 *              Password and sensitive fields are excluded.
 * @access Private (requires authUser middleware)
 */
const getMeController = asyncHandler(async (req, res) => {
    // .select("-password") excludes the password hash from the response
    const user = await userModel.findById(req.user.id).select("-password -otp -otpExpiry -resetPasswordToken -resetPasswordExpiry");

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


/**
 * @route POST /api/auth/forgot-password
 * @description Send a password reset link to the user's email.
 *              Always returns success to prevent email enumeration attacks.
 * @access Public
 */
const forgotPasswordController = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new AppError("Backend email service is not configured. Please ensure EMAIL_USER and EMAIL_PASS environment variables are set in the backend configuration.", 500);
    }

    if (!email) {
        throw new AppError("Please provide email", 400);
    }

    const user = await userModel.findOne({ email });

    // Always return success even if email doesn't exist (prevents enumeration)
    if (!user) {
        return res.status(200).json({
            success: true,
            message: "If an account exists with this email, a reset link has been sent.",
        });
    }

    // Send a helpful sign-in reminder email to Google OAuth users (Google accounts have no local password)
    if (user.authProvider === "google") {
        await sendGoogleAuthReminderEmail(email);
        return res.status(200).json({
            success: true,
            message: "If an account exists with this email, a reset link has been sent.",
        });
    }

    // Generate a secure reset token
    const rawToken = generateResetToken();
    // Store hashed version in DB so a database leak won't expose valid tokens
    user.resetPasswordToken = hashToken(rawToken);
    user.resetPasswordExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    // Build the reset URL pointing to the frontend page
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;
    try {
        await sendResetPasswordEmail(email, resetUrl);
    } catch (emailError) {
        console.error("Failed to send reset password email:", emailError);
        throw new AppError("Failed to send password reset email. Please try again later.", 500);
    }

    return res.status(200).json({
        success: true,
        message: "If an account exists with this email, a reset link has been sent.",
    });
});


/**
 * @route POST /api/auth/reset-password
 * @description Reset the user's password using the token from the email link.
 *              Token is hashed and compared against the stored hash in DB.
 * @access Public
 */
const resetPasswordController = asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        throw new AppError("Please provide token and new password", 400);
    }

    // Hash the incoming token to match against DB
    const hashedToken = hashToken(token);

    const user = await userModel.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpiry: { $gt: new Date() }, // Token must not be expired
    });

    if (!user) {
        throw new AppError("Invalid or expired reset token. Please request a new one.", 400);
    }

    // Update password (pre-save hook will hash it)
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;
    await user.save();

    return res.status(200).json({
        success: true,
        message: "Password reset successful. Please login with your new password.",
    });
});


/**
 * @route GET /api/auth/google/callback
 * @description Google OAuth callback handler. Passport handles authentication,
 *              we sign JWT and redirect to frontend workspace.
 *              Token is passed via URL query param because cross-domain cookies
 *              are blocked by modern browsers during redirects.
 * @access Public (Callback from Google)
 */
const googleAuthCallbackController = asyncHandler(async (req, res) => {
    if (!req.user) {
        const frontendUrl = (process.env.FRONTEND_URL || "https://ai-resume-analyzer-gray-ten.vercel.app").replace(/\/$/, "");
        return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    // Generate JWT token
    const token = jwt.sign(
        { id: req.user._id, username: req.user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    // Also set the cookie (for same-domain or subsequent API calls)
    res.cookie("token", token, getCookieOptions());

    // Pass token in URL so the frontend can store it via a dedicated API call
    const frontendUrl = (process.env.FRONTEND_URL || "https://ai-resume-analyzer-gray-ten.vercel.app").replace(/\/$/, "");
    return res.redirect(`${frontendUrl}/workspace?token=${token}`);
});


/**
 * @route POST /api/auth/contact
 * @description Submit the landing page contact form and send email to owner.
 * @access Public
 */
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


/**
 * @route POST /api/auth/set-token
 * @description Receives a JWT token in the request body, validates it,
 *              and sets it as an httpOnly cookie. Used by the frontend
 *              after Google OAuth redirect (cross-domain cookies are blocked
 *              by modern browsers, so token is passed via URL query param).
 * @access Public
 */
const setTokenController = asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
        throw new AppError("Token is required", 400);
    }

    // Verify the token is valid before setting it as a cookie
    try {
        jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        throw new AppError("Invalid or expired token", 401);
    }

    res.cookie("token", token, getCookieOptions());

    return res.status(200).json({
        success: true,
        message: "Token set successfully",
        token,
    });
});


module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController,
    verifyOtpController,
    resendOtpController,
    forgotPasswordController,
    resetPasswordController,
    googleAuthCallbackController,
    setTokenController,
    contactController,
};
