const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { load, response } = require('./helpers');
const secret = crypto.randomBytes(48).toString('hex');
const id = '507f1f77bcf86cd799439011';
const sign = (version = 0, expiresIn = 60) => jwt.sign({ id, tokenVersion: version }, secret, {
    expiresIn, jwtid: crypto.randomUUID(), issuer: 'prepwise', audience: 'prepwise-web',
});

test('middleware rejects missing, invalid, expired, and deleted-user cookies', async () => {
    const { authUser } = load('src/middlewares/auth.middleware.js', {
        '../models/user.model': { findById: () => ({ select: async () => null }) },
        '../models/blacklist.model': { findOne: async () => null },
    }, { JWT_SECRET: secret });
    for (const token of [undefined, 'invalid', sign(0, -1), sign()]) {
        const res = response();
        await authUser({ cookies: { token } }, res, () => assert.fail('Must not authenticate'));
        assert.equal(res.statusCode, 401);
    }
});

test('middleware accepts the current session version, rejects old versions, and excludes private fields', async () => {
    const { authUser } = load('src/middlewares/auth.middleware.js', {
        '../models/user.model': { findById: () => ({ select: async () => ({ _id: id, isVerified: true, tokenVersion: 2, password: 'must-not-expose' }) }) },
        '../models/blacklist.model': { findOne: async () => null },
    }, { JWT_SECRET: secret });
    const stale = response();
    await authUser({ cookies: { token: sign(1) } }, stale, () => assert.fail('Old session accepted'));
    assert.equal(stale.statusCode, 401);
    const req = { cookies: { token: sign(2) } };
    let passed = false;
    await authUser(req, response(), () => { passed = true; });
    assert.equal(passed, true);
    assert.equal(req.user.password, undefined);
});
