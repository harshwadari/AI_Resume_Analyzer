const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { load, response } = require('./helpers');
const { generateResetToken, hashToken } = require('../src/utils/otp.utils');

test('reset hashes the new password and atomically consumes the token while incrementing session version', async () => {
    const raw = generateResetToken();
    let query, update;
    const c = load('src/controllers/auth.controller.js', {
        '../utils/asyncHandler': fn => fn,
        '../models/user.model': { findOneAndUpdate: async (q, u) => { query = q; update = u; return { _id: 'user' }; } },
    });
    const res = response();
    await c.resetPasswordController({ body: { token: raw, password: 'NewPassword9' } }, res);
    assert.equal(query.resetPasswordToken, hashToken(raw));
    assert(query.resetPasswordExpiry.$gt instanceof Date);
    assert.equal(update.$set.resetPasswordToken, null);
    assert.equal(update.$inc.tokenVersion, 1);
    assert.equal(await bcrypt.compare('NewPassword9', update.$set.password), true);
    assert.equal(res.cleared, 'token');
});

test('forgot password sends links for combined accounts and reminders for Google-only accounts', async () => {
    let user = { _id: 'u', email: 'user@example.com', password: 'retained-hash', authProvider: 'google' };
    let resetUrl, reminder = false, stored;
    const c = load('src/controllers/auth.controller.js', {
        '../utils/asyncHandler': fn => fn,
        '../models/user.model': {
            findOne: async () => user, findOneAndUpdate: async () => user,
            updateOne: async (q, update) => { stored = update.$set; },
        },
        '../services/email.service': {
            sendResetPasswordEmail: async (email, url) => { resetUrl = url; },
            sendGoogleAuthReminderEmail: async () => { reminder = true; },
        },
    }, { EMAIL_USER: 'synthetic', EMAIL_PASS: 'synthetic' });
    const request = { body: { email: user.email } };
    const combined = response();
    await c.forgotPasswordController(request, combined);
    const raw = resetUrl.split('/').pop();
    assert.match(raw, /^[a-f0-9]{64}$/);
    assert.equal(stored.resetPasswordToken, hashToken(raw));
    user = { ...user, password: null };
    stored = null;
    const google = response();
    await c.forgotPasswordController(request, google);
    assert.equal(reminder, true);
    assert.equal(stored, null);
    assert.deepEqual(google.body, combined.body);
    user = null;
    const unknown = response();
    await c.forgotPasswordController(request, unknown);
    assert.deepEqual(unknown.body, combined.body);
});
