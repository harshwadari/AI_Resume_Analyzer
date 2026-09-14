const test = require('node:test');
const assert = require('node:assert/strict');
const { load, response } = require('./helpers');

test('shared rate limiter enforces account/IP counts without storing email/IP plaintext', async () => {
    const counts = new Map();
    const { rateLimit, ipKey } = load('src/middlewares/rate.middleware.js', {
        '../models/authRate.model': { findOneAndUpdate: async (query, update) => {
            assert.match(query._id, /^[a-f0-9]{64}$/);
            assert(update.$setOnInsert.expiresAt > new Date());
            const count = (counts.get(query._id) || 0) + 1;
            counts.set(query._id, count);
            return { count };
        } },
    }, { JWT_SECRET: 'synthetic-test-secret' });
    const limit = rateLimit('login', { ip: 10, account: 2 });
    let error;
    for (let i = 0; i < 3; i++) await limit({ ip: `127.0.0.${i}`, body: { email: ' USER@example.com ' } }, response(), e => { error = e; });
    assert.equal(error.statusCode, 429);
    assert.equal(ipKey('2001:db8:abcd:1234::1'), ipKey('2001:db8:abcd:1234:ffff:ffff:ffff:ffff'));
});
