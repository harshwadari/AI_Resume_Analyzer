const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { load, response } = require('./helpers');

test('logout revokes the matching account version; invalid tokens never cause database writes', async () => {
    const secret = 'synthetic-test-signing-secret-at-least-32-bytes';
    let updates = 0;
    const c = load('src/controllers/auth.controller.js', {
        '../utils/asyncHandler': fn => fn,
        '../models/user.model': { updateOne: async (query, update) => {
            updates++;
            assert.equal(query.tokenVersion, 2);
            assert.equal(update.$inc.tokenVersion, 1);
        } },
    }, { JWT_SECRET: secret });
    const token = jwt.sign({ id: '507f1f77bcf86cd799439011', tokenVersion: 2 }, secret, { issuer: 'prepwise', audience: 'prepwise-web', expiresIn: 60 });
    const res = response();
    await c.logoutUserController({ cookies: { token } }, res);
    assert.equal(res.cleared, 'token');
    await c.logoutUserController({ cookies: { token: 'arbitrary-string' } }, response());
    assert.equal(updates, 1);
});

test('logout still clears the browser cookie if database revocation fails', async () => {
    const secret = 'synthetic-test-signing-secret-at-least-32-bytes';
    const c = load('src/controllers/auth.controller.js', {
        '../utils/asyncHandler': fn => fn,
        '../models/user.model': { updateOne: async () => { throw Error('unavailable'); } },
    }, { JWT_SECRET: secret });
    const token = jwt.sign({ id: '507f1f77bcf86cd799439011', tokenVersion: 2 }, secret, { issuer: 'prepwise', audience: 'prepwise-web', expiresIn: 60 });
    const res = response();
    await assert.rejects(c.logoutUserController({ cookies: { token } }, res), /could not be confirmed/);
    assert.equal(res.cleared, 'token');
});
