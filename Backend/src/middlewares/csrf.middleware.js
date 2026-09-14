const { authConfig } = require('../config/auth.config');
const AppError = require('../utils/AppError');

function csrfGuard(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    // Browser forms cannot supply this header, and hostile origins cannot pass
    // the credentialed preflight. Reject Origin-less mutations as well.
    if (req.get('Origin') !== authConfig().frontend || req.get('X-Requested-With') !== 'XMLHttpRequest') {
        return next(new AppError('Request origin could not be verified', 403));
    }
    next();
}
module.exports = { csrfGuard };
