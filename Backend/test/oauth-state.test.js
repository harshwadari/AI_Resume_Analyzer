const test = require('node:test');
const assert = require('node:assert/strict');
const { load, response } = require('./helpers');
const { hashToken } = require('../src/utils/otp.utils');
const { requireRecentPassword } = require('../src/middlewares/link.middleware');

test('OAuth state binds browser, expires, and is consumed before authentication', async () => {
    let record, redirectOptions;
    const oauth = load('src/middlewares/oauth.middleware.js', {
        passport: { authenticate: (name, options) => { redirectOptions = options; return () => {}; } },
        '../models/oauthState.model': {
            create: async data => { record = data; },
            findOneAndDelete: async q => {
                if (!record || record._id !== q._id || record.browserHash !== q.browserHash || record.expiresAt <= q.expiresAt.$gt) return null;
                const result = record; record = null; return result;
            },
        },
    });
    const start = response();
    await oauth.startGoogle({}, start, err => { if (err) throw err; });
    assert.equal(hashToken(redirectOptions.state), record._id);
    const req = { query: { state: redirectOptions.state }, cookies: { oauth_browser: start.cookies.oauth_browser.value } };
    let error;
    await oauth.verifyGoogleState({ ...req, cookies: { oauth_browser: '0'.repeat(64) } }, response(), e => { error = e; });
    assert.equal(error.statusCode, 403);
    await oauth.verifyGoogleState(req, response(), e => { error = e; });
    assert.equal(error, undefined);
    await oauth.verifyGoogleState(req, response(), e => { error = e; });
    assert.equal(error.statusCode, 403);
    await oauth.startGoogle({}, start, () => {});
    record.expiresAt = new Date(0);
    await oauth.verifyGoogleState({ query: { state: redirectOptions.state }, cookies: { oauth_browser: start.cookies.oauth_browser.value } }, response(), e => { error = e; });
    assert.equal(error.statusCode, 403);
    await oauth.verifyGoogleState({ query: {}, cookies: {} }, response(), e => { error = e; });
    assert.equal(error.statusCode, 403);
});

test('explicit linking requires a recent password authentication', () => {
    let error;
    requireRecentPassword({ user: { id: 'u', authMethod: 'google', authTime: Date.now() / 1000 } }, response(), e => { error = e; });
    assert.equal(error.statusCode, 403);
    const req = { user: { id: 'u', authMethod: 'password', authTime: Date.now() / 1000 } };
    requireRecentPassword(req, response(), e => { error = e; });
    assert.equal(error, undefined);
    assert.equal(req.oauthLinkUserId, 'u');
});
