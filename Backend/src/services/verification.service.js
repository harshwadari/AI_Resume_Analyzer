const crypto = require('crypto');
const User = require('../models/user.model');
const { generateOtp } = require('../utils/otp.utils');
const { sendOtpEmail } = require('./email.service');
const AppError = require('../utils/AppError');

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60_000;
function otpHash(email, otp) {
    return crypto.createHmac('sha256', process.env.JWT_SECRET)
        .update(`registration:${email}:${otp}`).digest('hex');
}

async function issueOtp(user) {
    const otp = generateOtp();
    const hash = otpHash(user.email, otp);
    const updated = await User.findOneAndUpdate({
        _id: user._id, isVerified: false,
        $or: [{ otpSentAt: null }, { otpSentAt: { $lte: new Date(Date.now() - COOLDOWN_MS) } }],
    }, { $set: {
        otp: null, otpHash: hash, otpExpiry: new Date(Date.now() + 5 * 60_000),
        otpAttempts: 0, otpSentAt: new Date(),
    } }, { returnDocument: 'after' });
    if (!updated) return false;
    try {
        await sendOtpEmail(updated.email, otp);
    } catch {
        // Clear only our undelivered challenge, never a newer concurrent one.
        await User.updateOne({ _id: user._id, otpHash: hash }, { $set: { otpHash: null, otpExpiry: null } });
        console.error('Registration email delivery failed');
        throw new AppError('Verification email could not be sent. Please retry shortly.', 503);
    }
    return true;
}

async function consumeOtp(email, otp) {
    // Reserve one attempt atomically before comparing, including correct attempts.
    const candidate = await User.findOneAndUpdate({
        email, isVerified: false, otpExpiry: { $gt: new Date() },
        otpHash: { $type: 'string' }, otpAttempts: { $lt: MAX_ATTEMPTS },
    }, { $inc: { otpAttempts: 1 } }, { returnDocument: 'after' });
    if (!candidate) return null;
    const expected = otpHash(email, otp);
    if (candidate.otpHash !== expected) {
        await User.updateOne({ _id: candidate._id, otpHash: candidate.otpHash, otpAttempts: { $gte: MAX_ATTEMPTS } },
            { $set: { otpHash: null, otpExpiry: null } });
        return null;
    }
    return User.findOneAndUpdate({
        _id: candidate._id, isVerified: false, otpHash: expected,
        otpExpiry: { $gt: new Date() }, otpAttempts: { $lte: MAX_ATTEMPTS },
    }, { $set: { isVerified: true, otp: null, otpHash: null, otpExpiry: null, otpAttempts: 0 } }, { returnDocument: 'after' });
}
module.exports = { issueOtp, consumeOtp, otpHash };
