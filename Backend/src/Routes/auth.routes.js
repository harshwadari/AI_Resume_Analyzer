const {Router} = require('express')
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware")    
const validate = require("../middlewares/validate.middleware")
const passport = require("passport")
const { registerSchema, loginSchema, verifyOtpSchema, resendOtpSchema, forgotPasswordSchema, resetPasswordSchema, contactSchema } = require("../validations/auth.validations")

const authRouter = Router()

/**
 * @route POST /api/auth/register
 * @desc Register a new user and send OTP to email
 * @access Public
 */
authRouter.post("/register", validate(registerSchema), authController.registerUserController)

/**
 * @route POST /api/auth/login
 * @desc Login a user with email and password (must be verified)
 * @access Public
 */
authRouter.post("/login", validate(loginSchema), authController.loginUserController)

/**
 * @route POST /api/auth/verify-otp
 * @desc Verify the OTP sent to user's email during registration
 * @access Public
 */
authRouter.post("/verify-otp", validate(verifyOtpSchema), authController.verifyOtpController)

/**
 * @route POST /api/auth/resend-otp
 * @desc Resend a new OTP to the user's email
 * @access Public
 */
authRouter.post("/resend-otp", validate(resendOtpSchema), authController.resendOtpController)

/**
 * @route POST /api/auth/forgot-password
 * @desc Send a password reset link to user's email
 * @access Public
 */
authRouter.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPasswordController)

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using the token from email link
 * @access Public
 */
authRouter.post("/reset-password", validate(resetPasswordSchema), authController.resetPasswordController)

/**
 * @route GET /api/auth/logout
 * @desc Logout a user by blacklisting the token
 * @access Public
 */
authRouter.get("/logout", authController.logoutUserController)

/**
 * @route GET /api/auth/get-me
 * @desc Get the details of the logged in user, requires authentication
 * @access Private
 */
authRouter.get("/get-me", authMiddleware.authUser, authController.getMeController)

/**
 * @route GET /api/auth/google
 * @desc Initiate Google OAuth login flow
 * @access Public
 */
authRouter.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }))

/**
 * @route GET /api/auth/google/callback
 * @desc Callback from Google OAuth after authentication
 * @access Public
 */
authRouter.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: `${process.env.FRONTEND_URL || "https://ai-resume-analyzer-gray-ten.vercel.app"}/login`, session: false }),
    authController.googleAuthCallbackController
)

/**
 * @route POST /api/auth/set-token
 * @desc Set JWT token as httpOnly cookie (used after Google OAuth redirect)
 * @access Public
 */
authRouter.post("/set-token", authController.setTokenController)

/**
 * @route POST /api/auth/contact
 * @desc Submit contact form on landing page
 * @access Public
 */
authRouter.post("/contact", validate(contactSchema), authController.contactController)

module.exports = authRouter
