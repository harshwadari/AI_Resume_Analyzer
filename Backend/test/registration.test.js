const test = require('node:test');
const assert = require('node:assert/strict');
const { load, response } = require('./helpers');

test('repeat registration rejects existing pending accounts without changing credentials or sending OTP', async () => {
    const user = { username: 'original', email: 'user@example.com', password: 'original-hash', isVerified: false, save: async () => {} };
    const controller = load('src/controllers/auth.controller.js', {
        '../utils/asyncHandler': fn => fn,
        '../models/user.model': { findOne: () => ({ select: async () => user }) },
        '../services/email.service': { sendOtpEmail: async () => {} },
        '../services/verification.service': { issueOtp: async () => assert.fail('Duplicate registration must not send OTP') },
    }, { EMAIL_USER: 'synthetic', EMAIL_PASS: 'synthetic' });
    const res = response();
    await assert.rejects(controller.registerUserController({ body: { username: 'replacement', email: user.email, password: 'OtherPass9' } }, res),
        { statusCode: 409, message: 'A user with this username or email already exists. Please sign in or recover your password.' });
    assert.equal(user.password, 'original-hash');
    assert.equal(user.username, 'original');
    assert.equal(res.body, undefined);
});

test('registration handles a unique-index race as a duplicate error, not OTP success', async () => {
    const controller = load('src/controllers/auth.controller.js', {
        '../utils/asyncHandler': fn => fn,
        '../models/user.model': {
            findOne: () => ({ select: async () => null }),
            create: async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); },
        },
        '../services/verification.service': { issueOtp: async () => assert.fail('Duplicate must not issue OTP') },
    }, { EMAIL_USER: 'synthetic', EMAIL_PASS: 'synthetic' });
    await assert.rejects(controller.registerUserController({ body: { username: 'existing', email: 'user@example.com', password: 'ExamplePass9' } }, response()),
        { statusCode: 409 });
});

test('new registration reports pending-account recovery when email delivery fails', async () => {
    const controller = load('src/controllers/auth.controller.js', {
        '../utils/asyncHandler': fn => fn,
        '../models/user.model': { findOne: () => ({ select: async () => null }), create: async () => ({ _id: 'pending' }) },
        '../services/verification.service': { issueOtp: async () => { throw Object.assign(new Error('delivery failed'), { statusCode: 503 }); } },
    }, { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'synthetic', BREVO_FROM_EMAIL: 'sender@example.com' });
    await assert.rejects(controller.registerUserController({ body: { username: 'new', email: 'new@example.com', password: 'ExamplePass9' } }, response()),
        { statusCode: 503, message: 'Your account is pending verification, but the email could not be sent. Please sign in to retry verification shortly.' });
});
