const { startGoogle, verifyGoogleState } = require('../middlewares/oauth.middleware');
const { requireRecentPassword } = require('../middlewares/link.middleware');
const { rateLimit } = require('../middlewares/rate.middleware');
const {Router} = require('express')
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware")    
const validate = require("../middlewares/validate.middleware")
const passport = require("passport")
const { registerSchema, loginSchema, verifyOtpSchema, resendOtpSchema, forgotPasswordSchema, resetPasswordSchema, contactSchema, reauthenticateSchema } = require("../validations/auth.validations")

const authRouter = Router()

authRouter.post("/register", rateLimit("register", { ip: 30, account: 8 }), validate(registerSchema), authController.registerUserController)

authRouter.post("/login", rateLimit("login", { ip: 30, account: 10 }), validate(loginSchema), authController.loginUserController)

authRouter.post("/verify-otp", rateLimit("verify-otp", { ip: 30, account: 8 }), validate(verifyOtpSchema), authController.verifyOtpController)

authRouter.post("/resend-otp", rateLimit("resend-otp", { ip: 30, account: 8 }), validate(resendOtpSchema), authController.resendOtpController)

authRouter.post("/forgot-password", rateLimit("forgot-password", { ip: 10, account: 3 }), validate(forgotPasswordSchema), authController.forgotPasswordController)

authRouter.post("/reset-password", rateLimit("reset-password", { ip: 15, account: 0 }), validate(resetPasswordSchema), authController.resetPasswordController)

authRouter.post("/logout", rateLimit("logout", { ip: 30, account: 0 }), authController.logoutUserController)

authRouter.get("/get-me", authMiddleware.authUser, authController.getMeController)

authRouter.get("/google", rateLimit("google", { ip: 20, account: 0 }), startGoogle)

authRouter.get('/google/callback', (req, res, next) => {
    const failure = () => res.redirect(require('../config/auth.config').authConfig().frontend + '/login?error=google_auth_failed');
    verifyGoogleState(req, res, err => {
        if (err) return failure();
        passport.authenticate('google', { session: false }, (error, user) => {
            if (error || !user) return failure();
            req.user = user;
            authController.googleAuthCallbackController(req, res, next);
        })(req, res, next);
    });
})

authRouter.post("/contact", rateLimit("email-contact", { ip: 5, account: 3 }), validate(contactSchema), authController.contactController)

authRouter.post('/reauthenticate', rateLimit('reauthenticate', { ip: 10, account: 0 }), authMiddleware.authUser, validate(reauthenticateSchema), authController.reauthenticateController);
authRouter.get('/google/link', rateLimit('google', { ip: 20, account: 0 }), authMiddleware.authUser, requireRecentPassword, startGoogle);

module.exports = authRouter
