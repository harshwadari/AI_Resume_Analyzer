const test = require('node:test');
const assert = require('node:assert/strict');
const { load, response } = require('./helpers');

test('OAuth callback supports the first-party proxy and rejects unrelated destinations', () => {
    const env = { NODE_ENV: 'production', FRONTEND_URL: 'https://app.example.com', BACKEND_URL: 'https://backend.example.net',
        GOOGLE_CALLBACK_URL: 'https://app.example.com/api/auth/google/callback', COOKIE_SAME_SITE: 'lax' };
    const config = load('src/config/auth.config.js', {}, env);
    assert.equal(config.authConfig().googleCallback, env.GOOGLE_CALLBACK_URL);
    assert.equal(config.cookieOptions().sameSite, 'lax');
    for (const url of ['https://evil.example/api/auth/google/callback', 'https://app.example.com/wrong', 'https://app.example.com/api/auth/google/callback?next=evil']) {
        env.GOOGLE_CALLBACK_URL = url;
        assert.throws(() => config.authConfig(), /GOOGLE_CALLBACK_URL/);
    }
});

test('production cookies are secure/httpOnly/host-only and clearing uses the same scope', () => {
    const config = load('src/config/auth.config.js', {}, {
        NODE_ENV: 'production', FRONTEND_URL: 'https://app.example.com', BACKEND_URL: 'https://api.example.com',
    });
    const options = config.cookieOptions();
    assert.equal(options.secure, true);
    assert.equal(options.httpOnly, true);
    assert.equal(options.path, '/');
    assert.equal(options.domain, undefined);
    let cleared;
    config.clearAuthCookie({ clearCookie: (name, opts) => { cleared = opts; } });
    assert.equal(cleared.maxAge, undefined);
    assert.equal(cleared.sameSite, options.sameSite);
});

test('CSRF guard rejects missing/untrusted Origin and form requests', () => {
    const { csrfGuard } = load('src/middlewares/csrf.middleware.js', {
        '../config/auth.config': { authConfig: () => ({ frontend: 'https://app.example.com' }) },
    });
    for (const headers of [{}, { Origin: 'https://evil.example', 'X-Requested-With': 'XMLHttpRequest' }, { Origin: 'https://app.example.com' }]) {
        let error;
        csrfGuard({ method: 'POST', get: key => headers[key] }, response(), e => { error = e; });
        assert.equal(error.statusCode, 403);
    }
    let error;
    const headers = { Origin: 'https://app.example.com', 'X-Requested-With': 'XMLHttpRequest' };
    csrfGuard({ method: 'POST', get: key => headers[key] }, response(), e => { error = e; });
    assert.equal(error, undefined);
});
