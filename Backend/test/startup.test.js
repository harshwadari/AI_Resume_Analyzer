const test = require('node:test');
const assert = require('node:assert/strict');
const { load, response } = require('./helpers');

test('startup validates configuration and database indexes before accepting requests', async () => {
    const calls = [];
    let failIndexes = false;
    const { start } = load('server.js', {
        dotenv: { config() {} },
        './src/config/auth.config': { validateAuthConfig: () => calls.push('config') },
        './src/config/database': async () => calls.push('database'),
        './src/config/auth-indexes': { ensureAuthIndexes: async () => {
            calls.push('indexes');
            if (failIndexes) throw new Error('duplicate identity');
        } },
        './src/app': { listen: () => { calls.push('listen'); return 'server'; } },
    });
    assert.equal(await start(), 'server');
    assert.deepEqual(calls, ['config', 'database', 'indexes', 'listen']);
    calls.length = 0;
    failIndexes = true;
    await assert.rejects(start(), /duplicate identity/);
    assert.deepEqual(calls, ['config', 'database', 'indexes']);
});

test('successful Google callback sets cookie and redirects without a JWT in the URL', async () => {
    const controller = load('src/controllers/auth.controller.js', {
        '../config/auth.config': {
            authConfig: () => ({ frontend: 'http://localhost:5173' }),
            cookieOptions: () => ({ httpOnly: true, path: '/' }),
        },
    }, { JWT_SECRET: 'synthetic-test-secret-at-least-32-bytes' });
    const res = response();
    await new Promise((resolve, reject) => {
        const redirect = res.redirect;
        res.redirect = url => { redirect.call(res, url); resolve(); return res; };
        controller.googleAuthCallbackController({ user: { _id: 'user', tokenVersion: 2 } }, res, reject);
    });
    assert.equal(res.location, 'http://localhost:5173/workspace');
    assert.equal(res.cookies.token.options.httpOnly, true);
    const claims = require('jsonwebtoken').verify(res.cookies.token.value, 'synthetic-test-secret-at-least-32-bytes', {
        algorithms: ['HS256'], issuer: 'prepwise', audience: 'prepwise-web',
    });
    assert.equal(claims.authMethod, 'google');
    assert.equal(claims.tokenVersion, 2);
    assert.equal(claims.email, undefined);
});
