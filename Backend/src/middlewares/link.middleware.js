const AppError = require('../utils/AppError');
function requireRecentPassword(req, res, next) {
    const age = Date.now() / 1000 - req.user.authTime;
    if (req.user.authMethod !== 'password' || !Number.isFinite(age) || age < 0 || age > 300) {
        return next(new AppError('Confirm your password before linking Google', 403));
    }
    req.oauthLinkUserId = req.user.id;
    req.oauthLinkVersion = req.user.tokenVersion || 0;
    next();
}
module.exports = { requireRecentPassword };
