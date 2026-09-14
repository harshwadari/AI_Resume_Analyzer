const crypto = require('crypto');
const net = require('net');
const Rate = require('../models/authRate.model');
const AppError = require('../utils/AppError');

function ipKey(ip = '') {
    // Group IPv6 clients by /64, so address rotation cannot trivially evade limits.
    if (net.isIP(ip) === 6 && !ip.startsWith('::ffff:')) {
        const [left, right = ''] = ip.split('::');
        const a = left ? left.split(':') : [];
        const b = right ? right.split(':') : [];
        const groups = ip.includes('::') ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a;
        return groups.slice(0, 4).map(x => parseInt(x, 16).toString(16)).join(':');
    }
    return ip.replace(/^::ffff:/, '');
}

function rateLimit(scope, { ip = 30, account = 10, windowMs = 15 * 60_000 } = {}) {
    return async (req, res, next) => {
        try {
            const window = Math.floor(Date.now() / windowMs);
            const expiresAt = new Date((window + 1) * windowMs);
            const keys = [[`ip:${ipKey(req.ip)}`, ip]];
            if (account && typeof req.body?.email === 'string') keys.push([`email:${req.body.email.trim().toLowerCase()}`, account]);
            for (const [key, max] of keys) {
                const id = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${scope}:${window}:${key}`).digest('hex');
                let result;
                try {
                    result = await Rate.findOneAndUpdate({ _id: id }, {
                        $inc: { count: 1 }, $setOnInsert: { expiresAt },
                    }, { upsert: true, returnDocument: 'after' });
                } catch (err) {
                    if (err.code !== 11000) throw err;
                    result = await Rate.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { returnDocument: 'after' });
                }
                if (!result || result.count > max) {
                    res.set('Retry-After', String(Math.ceil((expiresAt.getTime() - Date.now()) / 1000)));
                    return next(new AppError('Too many requests. Please try again later.', 429));
                }
            }
            next();
        } catch { next(new AppError('Authentication temporarily unavailable', 503)); }
    };
}
module.exports = { rateLimit, ipKey };
