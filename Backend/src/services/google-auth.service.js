const crypto = require('crypto');
const User = require('../models/user.model');
const AppError = require('../utils/AppError');

async function resolveGoogleUser(profile, linkUserId = null, linkVersion = null) {
    const email = profile.emails?.[0]?.value?.trim().toLowerCase();
    if (!profile.id || typeof profile.id !== 'string' || !email || profile.emails[0].verified !== true) {
        throw new AppError('Google identity could not be verified', 401);
    }
    const existing = await User.findOne({ googleId: profile.id });
    if (existing) {
        if (linkUserId && String(existing._id) !== String(linkUserId)) throw new AppError('Google identity is already linked', 409);
        if (!existing.isVerified) throw new AppError('Account verification is required', 403);
        return existing;
    }
    const user = await User.findOne({ email });
    if (user) {
        if (linkUserId && linkVersion !== null && (user.tokenVersion || 0) !== linkVersion) throw new AppError('Please confirm your password again', 403);
        if (user.googleId && user.googleId !== profile.id) throw new AppError('Google identity conflicts with the account', 409);
        // Gmail and verified Workspace identities are authoritative. Other email
        // addresses need a recently password-authenticated explicit link flow.
        const authoritative = email.endsWith('@gmail.com') || Boolean(profile._json?.hd);
        if (!user.isVerified || (linkUserId ? String(user._id) !== String(linkUserId) : !authoritative)) {
            throw new AppError('Sign in with your password, verify your email, then link Google from your account.', 403);
        }
        const version = user.tokenVersion || 0;
        const versionFilter = version === 0 ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] } : { tokenVersion: version };
        const linked = await User.findOneAndUpdate({ _id: user._id, googleId: null, isVerified: true, ...versionFilter }, {
            $set: { googleId: profile.id, avatar: profile.photos?.[0]?.value || null, otp: null, otpHash: null, otpExpiry: null },
            $inc: { tokenVersion: 1 },
        }, { returnDocument: 'after' });
        if (linked) return linked;
        const concurrent = await User.findOne({ googleId: profile.id });
        if (concurrent && String(concurrent._id) === String(user._id)) return concurrent;
        throw new AppError('Google identity conflicts with the account', 409);
    }
    if (linkUserId) throw new AppError('Google email must match your account email', 409);
    try {
        return await User.create({
            username: `user_${crypto.randomBytes(10).toString('hex')}`,
            email, googleId: profile.id, authProvider: 'google', isVerified: true,
            avatar: profile.photos?.[0]?.value || null,
        });
    } catch (err) {
        if (err.code !== 11000) throw err;
        const concurrent = await User.findOne({ googleId: profile.id });
        if (concurrent) return concurrent;
        throw new AppError('Sign in to your existing account to link Google', 409);
    }
}
module.exports = { resolveGoogleUser };
