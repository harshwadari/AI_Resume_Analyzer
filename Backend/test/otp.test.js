const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

test('email failure invalidates only the undelivered OTP and reports service failure', async () => {
    let cleared;
    const service = load('src/services/verification.service.js', {
        '../models/user.model': {
            findOneAndUpdate: async () => ({ email: 'user@example.com' }),
            updateOne: async (query, update) => { cleared = { query, update }; },
        },
        './email.service': { sendOtpEmail: async () => { throw new Error('provider failed'); } },
    }, { JWT_SECRET: 'synthetic-test-key' });
    await assert.rejects(service.issueOtp({ _id: 'user', email: 'user@example.com' }), { statusCode: 503 });
    assert.equal(cleared.query._id, 'user');
    assert.match(cleared.query.otpHash, /^[a-f0-9]{64}$/);
    assert.equal(cleared.update.$set.otpHash, null);
});

test('OTP issuance stores a keyed hash, clears legacy plaintext, and enforces cooldown', async () => {
    let stored, delivered, query;
    const service = load('src/services/verification.service.js', {
        '../models/user.model': {
            findOneAndUpdate: async (q, u) => { query = q; stored = u.$set; return { email: 'user@example.com' }; },
        },
        './email.service': { sendOtpEmail: async (email, otp) => { delivered = otp; } },
    }, { JWT_SECRET: 'synthetic-test-key' });
    assert.equal(await service.issueOtp({ _id: 'user', email: 'user@example.com' }), true);
    assert.match(delivered, /^\d{6}$/);
    assert.equal(stored.otp, null);
    assert.equal(stored.otpHash, service.otpHash('user@example.com', delivered));
    assert.notEqual(stored.otpHash, delivered);
    assert.equal(stored.otpAttempts, 0);
    assert(query.$or[1].otpSentAt.$lte < new Date());
});

test('OTP consumption reserves a bounded attempt and conditionally consumes the hash', async () => {
    let calls = 0;
    let service;
    service = load('src/services/verification.service.js', {
        '../models/user.model': {
            findOneAndUpdate: async (query) => {
                if (++calls === 1) {
                    assert.equal(query.otpAttempts.$lt, 5);
                    return { _id: 'user', otpHash: service.otpHash('user@example.com', '123456') };
                }
                assert.equal(query.isVerified, false);
                assert.equal(query.otpHash, service.otpHash('user@example.com', '123456'));
                return { isVerified: true };
            },
        }, './email.service': {},
    }, { JWT_SECRET: 'synthetic-test-key' });
    assert.equal((await service.consumeOtp('user@example.com', '123456')).isVerified, true);
});
