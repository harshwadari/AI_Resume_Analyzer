const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { response } = require('./helpers');

// All credentials are synthetic. Never connect to the application's database.
Object.assign(process.env, {
    NODE_ENV: 'test', JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    FRONTEND_URL: 'http://localhost:5173', BACKEND_URL: 'http://localhost:3000',
    EMAIL_USER: 'test@example.invalid', EMAIL_PASS: 'synthetic',
    GOOGLE_CLIENT_ID: 'synthetic', GOOGLE_CLIENT_SECRET: 'synthetic', COOKIE_SAME_SITE: 'lax',
});
const User = require('../src/models/user.model');
const email = require('../src/services/email.service');
const mail = [];
email.sendOtpEmail = async (to, otp) => { mail.push({ type: 'otp', to, otp }); };
email.sendResetPasswordEmail = async (to, url) => { mail.push({ type: 'reset', to, url }); };
email.sendGoogleAuthReminderEmail = async to => { mail.push({ type: 'google', to }); };
const { issueOtp, consumeOtp } = require('../src/services/verification.service');
const { resolveGoogleUser } = require('../src/services/google-auth.service');
const controllers = require('../src/controllers/auth.controller');
const { generateResetToken, hashToken } = require('../src/utils/otp.utils');
let database;
let server, apiBase;

before(async () => {
    database = await MongoMemoryServer.create();
    await mongoose.connect(database.getUri(), { dbName: 'authentication-tests' });
    await User.init();
    await require('../src/config/auth-indexes').ensureAuthIndexes();
    // Isolate the unrelated AI service; authentication routes and Express app
    // are real. No external AI, email, or Google network requests are made.
    const aiPath = require.resolve('../src/services/ai.service');
    require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: async () => ({ title: 'Synthetic report', matchScore: 50 }) };
    const app = require('../src/app');
    server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    apiBase = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180_000 });
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await database?.stop();
});

async function request(path, { body, cookie, headers = {}, method = body === undefined ? 'GET' : 'POST' } = {}) {
    const res = await fetch(apiBase + path, {
        method, redirect: 'manual',
        headers: { Origin: process.env.FRONTEND_URL, 'X-Requested-With': 'XMLHttpRequest',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await res.text();
    return { status: res.status, headers: res.headers, body: raw.startsWith('{') ? JSON.parse(raw) : null };
}
const cookieFrom = res => res.headers.get('set-cookie')?.split(';')[0];

function invoke(name, body = {}, cookies = {}) {
    return new Promise((resolve, reject) => {
        const res = response();
        res.json = function(data) { this.body = data; resolve(this); return this; };
        controllers[name]({ body, cookies }, res, reject);
    });
}

test('database: OTP cooldown, old/expired codes, attempt limits and concurrent single-use', async () => {
    const user = await User.create({ username: 'otp-user', email: 'otp@example.com', password: 'ExamplePass9' });
    assert.equal(await issueOtp(user), true);
    const first = mail.at(-1).otp;
    assert.equal(await issueOtp(user), false);
    assert.equal((await User.findById(user.id)).otp, null);
    await User.updateOne({ _id: user.id }, { $set: { otpSentAt: new Date(0) } });
    await issueOtp(user);
    const second = mail.at(-1).otp;
    if (first !== second) assert.equal(await consumeOtp(user.email, first), null);
    await User.updateOne({ _id: user.id }, { $set: { otpExpiry: new Date(0) } });
    assert.equal(await consumeOtp(user.email, second), null);
    await User.updateOne({ _id: user.id }, { $set: { otpSentAt: new Date(0) } });
    await issueOtp(user);
    const third = mail.at(-1).otp;
    await Promise.all(Array.from({ length: 8 }, () => consumeOtp(user.email, '000000')));
    assert.equal((await User.findById(user.id)).otpAttempts, 5);
    assert.equal(await consumeOtp(user.email, third), null);
    await User.updateOne({ _id: user.id }, { $set: { otpSentAt: new Date(0) } });
    await issueOtp(user);
    const current = mail.at(-1).otp;
    const results = await Promise.all(Array.from({ length: 8 }, () => consumeOtp(user.email, current)));
    assert.equal(results.filter(Boolean).length, 1);
    const verified = await User.findById(user.id);
    assert.equal(verified.isVerified, true);
    assert.equal(verified.otpHash, null);
    assert.equal(await consumeOtp(user.email, current), null);
});

test('database: one Google identity has one account under concurrent signup; local password survives linking', async () => {
    const profile = { id: 'new-google-subject', displayName: 'A', emails: [{ value: 'new@gmail.com', verified: true }] };
    const results = await Promise.all(Array.from({ length: 4 }, () => resolveGoogleUser(profile)));
    assert.equal(new Set(results.map(user => user.id)).size, 1);
    assert.equal(await User.countDocuments({ googleId: profile.id }), 1);
    const local = await User.create({ username: 'local-google', email: 'local@gmail.com', password: 'ExamplePass9', isVerified: true });
    const beforeHash = local.password;
    const linked = await resolveGoogleUser({ id: 'local-subject', emails: [{ value: local.email, verified: true }] });
    assert.equal(linked.id, local.id);
    assert.equal(linked.password, beforeHash);
    assert.equal(linked.tokenVersion, 1);
    assert.equal(await linked.comparePassword('ExamplePass9'), true);
    await assert.rejects(User.create({ username: 'duplicate-google', email: 'different@gmail.com', googleId: 'local-subject' }), { code: 11000 });
});

test('database: concurrent reset consumes once, expires, and advances session version', async () => {
    const raw = generateResetToken();
    const user = await User.create({ username: 'reset-user', email: 'reset@example.com', password: 'ExamplePass9', isVerified: true,
        resetPasswordToken: hashToken(raw), resetPasswordExpiry: new Date(Date.now() + 60_000) });
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => invoke('resetPasswordController', { token: raw, password: 'ChangedPass9' })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const updated = await User.findById(user.id);
    assert.equal(await updated.comparePassword('ChangedPass9'), true);
    assert.equal(updated.tokenVersion, 1);
    assert.equal(updated.resetPasswordToken, null);
    await assert.rejects(invoke('resetPasswordController', { token: raw, password: 'AgainPass9' }), /Invalid or expired/);
    await User.updateOne({ _id: user.id }, { $set: { resetPasswordToken: hashToken(raw), resetPasswordExpiry: new Date(0) } });
    await assert.rejects(invoke('resetPasswordController', { token: raw, password: 'AgainPass9' }), /Invalid or expired/);
});

test('HTTP: registration, duplicate preservation, validation, OTP, login, logout and cookie-only protected access', async () => {
    const details = { username: 'http-user', email: ' HTTP@example.com ', password: 'ExamplePass9' };
    assert.equal((await request('/api/auth/register', { body: { ...details, password: 'weak' } })).status, 400);
    assert.equal((await request('/api/auth/register', { body: { ...details, email: 'invalid' } })).status, 400);
    const registered = await request('/api/auth/register', { body: details });
    assert.equal(registered.status, 200);
    assert.equal(registered.body.token, undefined);
    const original = await User.findOne({ email: 'http@example.com' });
    assert.equal(await original.comparePassword(details.password), true);
    const mailCount = mail.length;
    const repeat = await request('/api/auth/register', { body: { ...details, username: 'replacement', password: 'ChangedPass9' } });
    assert.equal(repeat.status, 409);
    assert.match(repeat.body.message, /username or email already exists/);
    assert.equal(repeat.body.requiresVerification, undefined);
    const sameUsername = await request('/api/auth/register', { body: { ...details, email: 'different-http@example.com' } });
    assert.equal(sameUsername.status, 409);
    assert.equal(await User.countDocuments({ email: 'different-http@example.com' }), 0);
    assert.equal(mail.length, mailCount);
    assert.equal((await User.findById(original.id)).password, original.password);
    const loginBody = { email: 'http@example.com', password: details.password };
    const unverified = await request('/api/auth/login', { body: loginBody });
    assert.equal(unverified.status, 403);
    assert.equal(unverified.body.requiresVerification, true);
    const otp = mail.filter(item => item.type === 'otp' && item.to === loginBody.email).at(-1).otp;
    const verified = await request('/api/auth/verify-otp', { body: { email: loginBody.email, otp } });
    assert.equal(verified.status, 200);
    assert.match(verified.headers.get('set-cookie'), /HttpOnly/i);
    assert.equal(verified.body.token, undefined);
    assert.equal((await request('/api/auth/verify-otp', { body: { email: loginBody.email, otp } })).status, 400);
    const duplicate = await request('/api/auth/register', { body: details });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(duplicate.body, repeat.body);
    const wrong = await request('/api/auth/login', { body: { ...loginBody, password: 'WrongPass9' } });
    const unknown = await request('/api/auth/login', { body: { ...loginBody, email: 'unknown@example.com' } });
    assert.deepEqual(wrong.body, unknown.body);
    const login = await request('/api/auth/login', { body: loginBody });
    assert.equal(login.status, 200);
    const cookie = cookieFrom(login);
    const me = await request('/api/auth/get-me', { cookie });
    assert.equal(me.status, 200);
    assert.deepEqual(Object.keys(me.body.user).sort(), ['email', 'id', 'username']);
    assert.equal((await request('/api/auth/get-me')).status, 401);
    assert.equal((await request('/api/auth/get-me', { headers: { Authorization: 'Bearer ' + cookie.slice(6) } })).status, 401);
    assert.equal((await request('/api/auth/logout', { cookie })).status, 404);
    const loggedOut = await request('/api/auth/logout', { cookie, body: {} });
    assert.equal(loggedOut.status, 200);
    assert.match(loggedOut.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
    assert.equal((await request('/api/auth/get-me', { cookie })).status, 401);
    assert.equal((await request('/api/auth/set-token', { body: { token: 'synthetic' } })).status, 404);
});

test('HTTP: recovery sends only hashed reset tokens to DB and invalidates existing sessions', async () => {
    const user = await User.create({ username: 'http-reset', email: 'http-reset@example.com', password: 'ExamplePass9', googleId: 'combined-http', authProvider: 'google', isVerified: true });
    const login = await request('/api/auth/login', { body: { email: user.email, password: 'ExamplePass9' } });
    const cookie = cookieFrom(login);
    const forgot = await request('/api/auth/forgot-password', { body: { email: user.email } });
    assert.equal(forgot.status, 200);
    const raw = mail.filter(item => item.type === 'reset' && item.to === user.email).at(-1).url.split('/').pop();
    assert.equal((await User.findById(user.id)).resetPasswordToken, hashToken(raw));
    assert.equal((await request('/api/auth/reset-password', { body: { token: '0'.repeat(64), password: 'ChangedPass9' } })).status, 400);
    assert.equal((await request('/api/auth/reset-password', { body: { token: raw, password: 'ChangedPass9' } })).status, 200);
    assert.equal((await request('/api/auth/get-me', { cookie })).status, 401);
    assert.equal((await request('/api/auth/reset-password', { body: { token: raw, password: 'AgainPass9' } })).status, 400);
    assert.equal((await request('/api/auth/login', { body: { email: user.email, password: 'ChangedPass9' } })).status, 200);
    const google = await User.create({ username: 'http-google', email: 'http-google@gmail.com', googleId: 'only-google', isVerified: true });
    const reminder = await request('/api/auth/forgot-password', { body: { email: google.email } });
    assert.deepEqual(reminder.body, forgot.body);
    assert.equal(mail.at(-1).type, 'google');
    assert.equal((await User.findById(google.id)).resetPasswordToken, null);
    assert.equal((await request('/api/auth/login', { body: { email: google.email, password: 'ExamplePass9' } })).status, 400);
});

test('HTTP: CSRF and rate limiting reject hostile requests', async () => {
    for (const headers of [{ Origin: 'https://attacker.example' }, { Origin: '' }, { 'X-Requested-With': '' }]) {
        assert.equal((await request('/api/auth/login', { body: { email: 'limits@example.com', password: 'WrongPass9' }, headers })).status, 403);
    }
    for (let i = 0; i < 10; i++) assert.equal((await request('/api/auth/login', { body: { email: 'limits@example.com', password: 'WrongPass9' } })).status, 400);
    const limited = await request('/api/auth/login', { body: { email: 'limits@example.com', password: 'WrongPass9' } });
    assert.equal(limited.status, 429);
    assert(limited.headers.get('retry-after'));
});

test('HTTP: OAuth initiation sets browser-bound state; invalid callback is rejected without JWT URL exposure', async () => {
    const start = await request('/api/auth/google');
    assert.equal(start.status, 302);
    const location = new URL(start.headers.get('location'));
    assert.equal(location.hostname, 'accounts.google.com');
    assert.match(location.searchParams.get('state'), /^[a-f0-9]{64}$/);
    assert.match(start.headers.get('set-cookie'), /oauth_browser=.*HttpOnly/i);
    const invalid = await request('/api/auth/google/callback?state=bad&code=synthetic');
    assert.equal(invalid.status, 302);
    assert.equal(new URL(invalid.headers.get('location')).searchParams.has('token'), false);
    assert.match(invalid.headers.get('location'), /google_auth_failed/);
});

test('HTTP: every protected interview route rejects deleted users; ownership prevents cross-account reads', async () => {
    const user = await User.create({ username: 'http-owner', email: 'owner@example.com', password: 'ExamplePass9', isVerified: true });
    const login = await request('/api/auth/login', { body: { email: user.email, password: 'ExamplePass9' } });
    const cookie = cookieFrom(login);
    const Report = require('../src/models/interviewReport.model');
    const report = await Report.create({ user: user.id, title: 'Private', jobDescription: 'Synthetic' });
    assert.equal((await request('/api/interview/report/' + report.id, { cookie })).status, 200);
    const other = await User.create({ username: 'http-other', email: 'other@example.com', password: 'ExamplePass9', isVerified: true });
    const otherCookie = cookieFrom(await request('/api/auth/login', { body: { email: other.email, password: 'ExamplePass9' } }));
    assert.equal((await request('/api/interview/report/' + report.id, { cookie: otherCookie })).status, 404);
    const ownList = await request('/api/interview', { cookie });
    assert.equal(ownList.status, 200);
    assert.deepEqual(ownList.body.interviewReports.map(item => item._id), [report.id]);
    const otherList = await request('/api/interview', { cookie: otherCookie });
    assert.equal(otherList.status, 200);
    assert.deepEqual(otherList.body.interviewReports, []);
    await User.deleteOne({ _id: user.id });
    for (const path of ['/api/auth/get-me', '/api/interview', '/api/interview/report/' + report.id]) {
        assert.equal((await request(path, { cookie })).status, 401);
    }
    assert.equal((await request('/api/interview', { cookie, body: { jobDescription: 'Synthetic', selfDescription: 'Synthetic' } })).status, 401);
});
