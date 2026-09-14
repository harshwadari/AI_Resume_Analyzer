const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { load, response } = require('./helpers');
const schemas = require('../src/validations/auth.validations');

test('password login works for a combined account and rejects unknown, Google-only, wrong credentials', async () => {
    let user = { _id: 'user', username: 'user', email: 'user@example.com', password: await bcrypt.hash('ExamplePass9', 10), isVerified: true, authProvider: 'google' };
    const c = load('src/controllers/auth.controller.js', {
        '../models/user.model': { findOne: async () => user },
        '../utils/asyncHandler': fn => fn,
    }, { JWT_SECRET: 'synthetic-test-secret-for-signing-only' });
    const req = { body: { email: user.email, password: 'ExamplePass9' } };
    const res = response();
    await c.loginUserController(req, res);
    assert.equal(res.body.user.id, 'user');
    assert(res.cookies.token.options.httpOnly);
    await assert.rejects(c.loginUserController({ body: { ...req.body, password: 'WrongPass9' } }, response()), /Invalid email or password/);
    user = { ...user, password: null };
    await assert.rejects(c.loginUserController(req, response()), /Invalid email or password/);
    user = null;
    await assert.rejects(c.loginUserController(req, response()), /Invalid email or password/);
});

test('new password policy rejects weak and over-72-byte passwords', () => {
    for (const password of ['weak', 'Aa1' + 'x'.repeat(70), 'Aa1' + '😀'.repeat(18)]) {
        assert.equal(schemas.registerSchema.safeParse({ username: 'user', email: 'user@example.com', password }).success, false);
    }
});
