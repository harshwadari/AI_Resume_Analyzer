const crypto = require('crypto');
const passport = require('passport');
const State = require('../models/oauthState.model');
const User = require('../models/user.model');
const { hashToken } = require('../utils/otp.utils');
const AppError = require('../utils/AppError');

const browserOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google' });

async function startGoogle(req, res, next) {
    try {
        const state = crypto.randomBytes(32).toString('hex');
        const browser = crypto.randomBytes(32).toString('hex');
        await State.create({
            _id: hashToken(state), browserHash: hashToken(browser),
            expiresAt: new Date(Date.now() + 5 * 60_000),
            linkUserId: req.oauthLinkUserId || null, linkVersion: req.oauthLinkVersion || 0,
        });
        res.cookie('oauth_browser', browser, { ...browserOptions(), maxAge: 5 * 60_000 });
        passport.authenticate('google', { scope: ['profile', 'email'], session: false, state })(req, res, next);
    } catch { next(new AppError('Unable to start Google login', 503)); }
}

async function verifyGoogleState(req, res, next) {
    const state = req.query.state;
    const browser = req.cookies?.oauth_browser;
    res.clearCookie('oauth_browser', browserOptions());
    try {
        if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) || typeof browser !== 'string' || !/^[a-f0-9]{64}$/.test(browser)) {
            throw new AppError('Invalid or expired Google login. Please start again.', 403);
        }
        const transaction = await State.findOneAndDelete({
            _id: hashToken(state), browserHash: hashToken(browser), expiresAt: { $gt: new Date() },
        });
        if (!transaction) throw new AppError('Invalid or expired Google login. Please start again.', 403);
        if (transaction.linkUserId) {
            const user = await User.findById(transaction.linkUserId);
            if (!user?.isVerified || (user.tokenVersion || 0) !== transaction.linkVersion) throw new AppError('Please confirm your password again', 403);
            req.oauthLinkUserId = String(user._id);
            req.oauthLinkVersion = transaction.linkVersion;
        }
        next();
    } catch (err) { next(err instanceof AppError ? err : new AppError('Google login temporarily unavailable', 503)); }
}
module.exports = { startGoogle, verifyGoogleState };
