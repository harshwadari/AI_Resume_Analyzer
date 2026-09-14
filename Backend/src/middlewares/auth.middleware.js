const jwt = require("jsonwebtoken")
const User = require('../models/user.model');
const { isValidObjectId } = require('mongoose');
const AppError = require('../utils/AppError');

async function authUser(req, res, next) {
    try {
        // Browser authentication uses the httpOnly cookie exclusively.
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                message: "Unauthorized, token not found"
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'prepwise', audience: 'prepwise-web' });
        if (!isValidObjectId(decoded.id)) throw new jwt.JsonWebTokenError('Invalid subject');
        if (!Number.isInteger(decoded.tokenVersion) || typeof decoded.jti !== 'string') throw new jwt.JsonWebTokenError('Legacy session');
        const user = await User.findById(decoded.id).select('_id username email isVerified role tokenVersion');
        if (!user || !user.isVerified || decoded.tokenVersion !== (user.tokenVersion || 0)) return res.status(401).json({ success: false, message: 'Please sign in again' });
        req.user = { id: String(user._id), username: user.username, email: user.email, role: user.role,
            authMethod: decoded.authMethod, authTime: decoded.authTime, tokenVersion: user.tokenVersion || 0 };
        req.auth = { jti: decoded.jti, expiresAt: decoded.exp };
        next()

    } catch (err) {
        if (!(err instanceof jwt.JsonWebTokenError) && !(err instanceof jwt.TokenExpiredError) && !(err instanceof jwt.NotBeforeError)) {
            return next(new AppError('Authentication temporarily unavailable', 503));
        }
        return res.status(401).json({
            message: "Unauthorized, invalid token"
        })
    }
}

module.exports = { authUser }
