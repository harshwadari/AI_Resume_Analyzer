const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
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
let jdStorageDir;

before(async () => {
    jdStorageDir = await require('node:fs/promises').mkdtemp(require('node:path').join(require('node:os').tmpdir(), 'prepwise-jd-test-'));
    process.env.JD_STORAGE_DIR = jdStorageDir;
    process.env.RESUME_STORAGE_DIR = require('node:path').join(jdStorageDir, 'resumes');
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
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
    if (jdStorageDir) await require('node:fs/promises').rm(jdStorageDir, { recursive: true, force: true });
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

test('HTTP: ZIP queues 100 individual resumes, reports rejected files and cleans temporary extraction', async () => {
    const owner = await User.create({ username: 'zip-owner', email: 'zip-owner@example.com', password: 'ExamplePass9', isVerified: true });
    const cookie = 'token=' + require('jsonwebtoken').sign({ id: owner.id, tokenVersion: 0, jti: crypto.randomUUID() }, process.env.JWT_SECRET,
        { algorithm: 'HS256', issuer: 'prepwise', audience: 'prepwise-web', expiresIn: '1h' });
    const created = await request('/api/recruiter/analyses', { cookie, body: { rawJDText: 'ZIP upload test job description with Node.js development responsibilities, reliable services, code review and team collaboration.' } });
    const analysisId = created.body.analysis.id;
    const fs = require('node:fs/promises'), { tempRoot } = require('../src/middlewares/resume-zip.middleware');
    await fs.mkdir(tempRoot, { recursive: true });
    const before = await fs.readdir(tempRoot);
    const send = async (bytes, auth = cookie) => {
        const body = new FormData(); body.append('archive', new Blob([bytes], { type: 'application/zip' }), 'resumes.zip');
        const response = await fetch(`${apiBase}/api/recruiter/analyses/${analysisId}/resumes/zip`, { method: 'POST', body,
            headers: { Origin: process.env.FRONTEND_URL, 'X-Requested-With': 'XMLHttpRequest', ...(auth ? { Cookie: auth } : {}) } });
        return { status: response.status, body: await response.json() };
    };
    const zip = require('./zip-fixture')(Array.from({ length: 100 }, (_, index) => ({ name: `${index}.pdf`, data: require('./pdf-fixture')() })));
    assert.equal((await send(zip, '')).status, 401);
    const result = await send(zip);
    assert.equal(result.status, 201, JSON.stringify(result.body)); assert.equal(result.body.resumes.length, 100);
    assert.ok(result.body.resumes.every(item => item.processingStatus === 'UPLOADED'));
    const list = await request(`/api/recruiter/analyses/${analysisId}/resumes`, { cookie });
    assert.equal(list.body.total, 100); assert.equal(list.body.resumes.length, 50);
    assert.equal((await request(`/api/recruiter/analyses/${analysisId}/resumes?page=2`, { cookie })).body.resumes.length, 50);
    const invalid = await send(require('./zip-fixture')([{ name: 'bad.pdf', data: Buffer.from('fake') }, { name: 'notes.txt', data: Buffer.from('text') }]));
    assert.equal(invalid.status, 201); assert.equal(invalid.body.rejected.length, 2); assert.equal(invalid.body.resumes.length, 0);
    assert.equal((await send(require('./zip-fixture')([{ name: '../escape.pdf', data: require('./pdf-fixture')() }]))).status, 400);
    assert.equal((await send(Buffer.alloc(50 * 1024 * 1024 + 1))).status, 413);
    assert.deepEqual(await fs.readdir(tempRoot), before);
});

test('HTTP: single and ten-resume uploads persist private metadata and reject invalid batches', async () => {
    const fs = require('node:fs/promises');
    const Resume = require('../src/models/resume.model');
    const initialStored = (await fs.readdir(process.env.RESUME_STORAGE_DIR).catch(() => [])).length;
    const owner = await User.create({ username: 'resume-owner', email: 'resume-owner@example.com', password: 'ExamplePass9', isVerified: true });
    const other = await User.create({ username: 'resume-other', email: 'resume-other@example.com', password: 'ExamplePass9', isVerified: true });
    const cookieFor = user => 'token=' + require('jsonwebtoken').sign({ id: user.id, tokenVersion: 0, jti: crypto.randomUUID() }, process.env.JWT_SECRET,
        { algorithm: 'HS256', issuer: 'prepwise', audience: 'prepwise-web', expiresIn: '1h' });
    const cookie = cookieFor(owner);
    const created = await request('/api/recruiter/analyses', { cookie, body: { rawJDText: 'Resume ingestion test job description with Node.js development responsibilities, reliable services, code review and team collaboration.' } });
    const id = created.body.analysis.id, path = `/api/recruiter/analyses/${id}/resumes`;
    const pdf = require('./pdf-fixture')();
    const upload = async (files, auth = cookie, origin = process.env.FRONTEND_URL) => {
        const form = new FormData();
        files.forEach(file => form.append('resumes', new Blob([file.bytes || pdf], { type: file.type || 'application/pdf' }), file.name));
        const res = await fetch(apiBase + path, { method: 'POST', headers: { Origin: origin, 'X-Requested-With': 'XMLHttpRequest', ...(auth ? { Cookie: auth } : {}) }, body: form });
        return { status: res.status, body: await res.json() };
    };
    assert.equal((await upload([{ name: 'one.pdf' }], '')).status, 401);
    assert.equal((await upload([{ name: 'one.pdf' }], cookieFor(other))).status, 404);
    assert.equal((await upload([{ name: 'one.pdf' }], cookie, 'https://attacker.example')).status, 403);
    assert.equal((await upload([])).status, 400);
    assert.equal((await upload([{ name: 'file.zip', type: 'application/zip' }])).status, 400);
    assert.equal((await upload([{ name: 'good.pdf' }, { name: 'bad.pdf', bytes: Buffer.from('%PDF-invalid') }])).status, 400);
    assert.equal((await upload([{ name: 'large.pdf', bytes: Buffer.alloc(5 * 1024 * 1024 + 1) }])).status, 413);
    assert.equal((await upload(Array.from({ length: 11 }, (_, index) => ({ name: `${index}.pdf` })))).status, 400);
    assert.equal(await Resume.countDocuments({ analysis: id }), 0);
    const single = await upload([{ name: '../../resume.pdf' }]);
    assert.equal(single.status, 201, JSON.stringify(single.body));
    assert.equal(single.body.resumes.length, 1);
    const record = single.body.resumes[0];
    assert.equal(record.originalFilename, 'resume.pdf');
    assert.equal(record.analysisId, id);
    assert.equal(record.recruiterId, owner.id);
    assert.equal(record.processingStatus, 'UPLOADED');
    assert.ok(record.createdAt);
    assert.equal(record.storageReference, undefined);
    const ten = await upload(Array.from({ length: 10 }, (_, index) => ({ name: `resume-${index}.pdf` })));
    assert.equal(ten.status, 201, JSON.stringify(ten.body));
    assert.equal(ten.body.resumes.length, 10);
    const list = await request(path, { cookie });
    assert.equal(list.status, 200);
    assert.equal(list.body.total, 11);
    assert.equal(new Set(list.body.resumes.map(item => item.id)).size, 11);
    for (const saved of await Resume.find({ analysis: id }).select('+storageReference')) {
        assert.equal(saved.processingStatus, 'UPLOADED');
        assert.deepEqual(await fs.readFile(require('../src/services/resume-storage.service').filePath(saved.storageReference)), pdf);
    }
    assert.equal((await request(path, { cookie: cookieFor(other) })).status, 404);
    assert.equal((await request(path)).status, 401);
    assert.equal((await request(path + '?page=0', { cookie })).status, 400);
    assert.equal((await request(path + '?page=2', { cookie })).body.resumes.length, 0);
    const originalCreate = Resume.create;
    try {
        Resume.create = async () => { throw new Error('Synthetic database failure'); };
        assert.equal((await upload([{ name: 'rollback.pdf' }])).status, 500);
    } finally { Resume.create = originalCreate; }
    assert.equal(await Resume.countDocuments({ analysis: id }), 11);
    assert.equal((await fs.readdir(process.env.RESUME_STORAGE_DIR)).length, initialStored + 11);
    const invalid = new Resume({ analysis: id, recruiter: owner.id, originalFilename: 'test.pdf', storageReference: 'private', size: 1, processingStatus: 'ARBITRARY' });
    await assert.rejects(invalid.validate(), /processingStatus/);
});

test('HTTP: requirement extraction validates AI output before persistence and supports owner review', async () => {
    const Analysis = require('../src/models/analysis.model');
    const owner = await User.create({ username: 'requirements-owner', email: 'requirements@example.com', password: 'ExamplePass9', isVerified: true });
    const other = await User.create({ username: 'requirements-other', email: 'requirements-other@example.com', password: 'ExamplePass9', isVerified: true });
    const cookieFor = user => 'token=' + require('jsonwebtoken').sign({ id: user.id, tokenVersion: 0, jti: crypto.randomUUID() }, process.env.JWT_SECRET,
        { algorithm: 'HS256', issuer: 'prepwise', audience: 'prepwise-web', expiresIn: '1h' });
    const cookie = cookieFor(owner);
    const rawJDText = 'Backend engineer. Requires Node.js and MongoDB with 3+ years experience. Python preferred. Build reliable APIs. Remote, full-time.';
    const created = await request('/api/recruiter/analyses', { cookie, body: { rawJDText } });
    const id = created.body.analysis.id;
    const path = `/api/recruiter/analyses/${id}/requirements`;
    const structuredJD = require('../../ai-service/tests/requirements.json');
    const valid = { structuredJD, parserVersion: 'jd-v1', modelName: 'gemini-2.5-flash', extractedAt: new Date().toISOString() };
    let result = valid, calls = 0, received;
    const mock = require('node:http').createServer(async (req, res) => {
        calls++;
        let body = ''; for await (const chunk of req) body += chunk;
        received = { body: JSON.parse(body), token: req.headers['x-ai-service-token'], path: req.url };
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result));
    });
    await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
    const oldUrl = process.env.AI_SERVICE_URL, oldToken = process.env.AI_SERVICE_TOKEN;
    process.env.AI_SERVICE_URL = `http://127.0.0.1:${mock.address().port}`;
    process.env.AI_SERVICE_TOKEN = 's'.repeat(40);
    try {
        assert.equal((await request(path + '/extract', { body: {} })).status, 401);
        assert.equal((await request(path + '/extract', { cookie: cookieFor(other), body: {} })).status, 404);
        assert.equal((await request(path + '/extract', { cookie, body: { structuredJD } })).status, 400);
        assert.equal((await request(path + '/review', { cookie, body: {} })).status, 409);
        assert.equal(calls, 0);
        for (const bad of [{}, { ...valid, structuredJD: { ...structuredJD, extra: 'untrusted' } },
            { ...valid, structuredJD: { ...structuredJD, minimumExperience: '3' } },
            { ...valid, structuredJD: { ...structuredJD, maximumExperience: 1 } }, { ...valid, extractedAt: 'invalid' }]) {
            result = bad;
            assert.equal((await request(path + '/extract', { cookie, body: {} })).status, 502);
            const unchanged = await Analysis.findById(id);
            assert.equal(unchanged.structuredJD, undefined);
            assert.equal(unchanged.rawJDText, rawJDText);
        }
        result = valid;
        const extracted = await request(path + '/extract', { cookie, body: {} });
        assert.equal(extracted.status, 200);
        assert.deepEqual(extracted.body.analysis.structuredJD, structuredJD);
        assert.equal(extracted.body.analysis.requirementsReviewedAt, null);
        assert.deepEqual(received, { body: { rawJDText }, token: process.env.AI_SERVICE_TOKEN, path: '/v1/jd/extract' });
        const count = calls;
        assert.equal((await request(path + '/extract', { cookie, body: {} })).status, 200);
        assert.equal(calls, count, 'Already extracted requirements should not trigger another model call');
        assert.equal((await request(path + '/review', { cookie: cookieFor(other), body: {} })).status, 404);
        const reviewed = await request(path + '/review', { cookie, body: {} });
        assert.equal(reviewed.status, 200);
        assert.ok(reviewed.body.analysis.requirementsReviewedAt);
        const reloaded = await request(`/api/recruiter/analyses/${id}`, { cookie });
        assert.equal(reloaded.body.analysis.requirementsReviewedAt, reviewed.body.analysis.requirementsReviewedAt);
        const stored = await Analysis.findById(id);
        assert.equal(stored.rawJDText, rawJDText);
        assert.equal(stored.parserVersion, 'jd-v1');
        assert.equal(stored.modelName, valid.modelName);
        assert.ok(stored.extractedAt instanceof Date);
        stored.structuredJD = { arbitrary: 'unvalidated' };
        await assert.rejects(stored.save(), /Invalid structured JD/);
    } finally {
        await new Promise(resolve => mock.close(resolve));
        if (oldUrl === undefined) delete process.env.AI_SERVICE_URL; else process.env.AI_SERVICE_URL = oldUrl;
        if (oldToken === undefined) delete process.env.AI_SERVICE_TOKEN; else process.env.AI_SERVICE_TOKEN = oldToken;
    }
});

test('HTTP: JD PDF extraction, private original storage, validation and owner-only download', async () => {
    const fs = require('node:fs/promises');
    const Analysis = require('../src/models/analysis.model');
    const owner = await User.create({ username: 'pdf-owner', email: 'pdf-owner@example.com', password: 'ExamplePass9', isVerified: true });
    const other = await User.create({ username: 'pdf-other', email: 'pdf-other@example.com', password: 'ExamplePass9', isVerified: true });
    const cookieFor = user => 'token=' + require('jsonwebtoken').sign({ id: user.id, tokenVersion: 0, jti: crypto.randomUUID() }, process.env.JWT_SECRET,
        { algorithm: 'HS256', issuer: 'prepwise', audience: 'prepwise-web', expiresIn: '1h' });
    const cookie = cookieFor(owner);
    const pdf = require('./pdf-fixture')();
    const upload = async (bytes, { name = 'job.pdf', type = 'application/pdf', auth = cookie, origin = process.env.FRONTEND_URL } = {}) => {
        const form = new FormData();
        if (bytes) form.append('jd', new Blob([bytes], { type }), name);
        const res = await fetch(apiBase + '/api/recruiter/analyses/pdf', { method: 'POST',
            headers: { Origin: origin, 'X-Requested-With': 'XMLHttpRequest', ...(auth ? { Cookie: auth } : {}) }, body: form });
        return { status: res.status, body: await res.json() };
    };
    assert.equal((await upload(pdf, { auth: '' })).status, 401);
    assert.equal((await upload(pdf, { origin: 'https://attacker.example' })).status, 403);
    assert.equal((await upload(null)).status, 400);
    assert.equal((await upload(pdf, { name: 'job.txt', type: 'text/plain' })).status, 400);
    assert.equal((await upload(Buffer.from('not a PDF'))).status, 400);
    assert.equal((await upload(Buffer.from('%PDF-1.4\nmalformed'))).status, 422);
    assert.equal((await upload(require('./pdf-fixture')(''))).status, 422);
    assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
    assert.equal(await Analysis.countDocuments({ recruiter: owner.id }), 0);
    assert.deepEqual((await fs.readdir(jdStorageDir)).filter(name => name.endsWith('.pdf')), []);
    const created = await upload(pdf, { name: '../../unsafe<>job.pdf' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const record = created.body.analysis;
    assert.equal(record.sourceType, 'pdf');
    assert.equal(record.extractionStatus, 'completed');
    assert.match(record.rawJDText, /Senior Engineer/);
    assert.equal(record.originalFile.key, undefined);
    assert.doesNotMatch(record.originalFile.name, /[<>/\\]/);
    const stored = await Analysis.findById(record.id);
    assert.equal(stored.rawJDText, record.rawJDText);
    assert.deepEqual(await fs.readFile(require('../src/services/jd-storage.service').filePath(stored.originalFile.key)), pdf);
    const url = `/api/recruiter/analyses/${record.id}/original`;
    assert.equal((await request(url)).status, 401);
    assert.equal((await request(url, { cookie: cookieFor(other) })).status, 404);
    const downloaded = await fetch(apiBase + url, { headers: { Cookie: cookie } });
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get('content-disposition'), /^attachment/);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), pdf);
    await Analysis.updateOne({ _id: record.id }, { $set: { sourceType: 'text', originalFile: { key: 'changed' }, rawJDText: 'changed '.repeat(30) } });
    const preserved = await Analysis.findById(record.id);
    assert.equal(preserved.originalFile.key, stored.originalFile.key);
    assert.equal(preserved.rawJDText, record.rawJDText);
});

test('HTTP: recruiter JD creation preserves original text and isolates ownership', async () => {
    const Analysis = require('../src/models/analysis.model');
    const owner = await User.create({ username: 'jd-owner', email: 'jd-owner@example.com', password: 'ExamplePass9', isVerified: true });
    const other = await User.create({ username: 'jd-other', email: 'jd-other@example.com', password: 'ExamplePass9', isVerified: true });
    const cookieFor = user => 'token=' + require('jsonwebtoken').sign({ id: user.id, tokenVersion: 0, jti: crypto.randomUUID() }, process.env.JWT_SECRET,
        { algorithm: 'HS256', issuer: 'prepwise', audience: 'prepwise-web', expiresIn: '1h' });
    const cookie = cookieFor(owner);
    const path = '/api/recruiter/analyses';
    const rawJDText = '  Senior Engineer\r\n\r\nBuild reliable Node.js services, review code, and collaborate with product teams. Experience with MongoDB and API design required.\n  ';
    assert.equal((await request(path, { body: { rawJDText } })).status, 401);
    assert.equal((await request(path, { cookie, body: { rawJDText }, headers: { Origin: 'https://attacker.example' } })).status, 403);
    for (const text of ['', ' '.repeat(150), 'x'.repeat(99), 'x'.repeat(20001)]) {
        assert.equal((await request(path, { cookie, body: { rawJDText: text } })).status, 400);
    }
    assert.equal((await request(path, { cookie, body: { rawJDText, recruiter: other.id } })).status, 400);
    assert.equal((await request(path, { cookie, body: { rawJDText, status: 'completed' } })).status, 400);
    assert.equal((await request(path, { cookie, body: { rawJDText: 'x'.repeat(150000) } })).status, 413);
    assert.equal(await Analysis.countDocuments({ recruiter: owner.id }), 0);

    const created = await request(path, { cookie, body: { rawJDText } });
    assert.equal(created.status, 201);
    const record = created.body.analysis;
    assert.match(record.id, /^[a-f0-9]{24}$/);
    assert.equal(record.recruiter, owner.id);
    assert.equal(record.sourceType, 'text');
    assert.equal(record.status, 'draft');
    assert.equal(record.rawJDText, rawJDText);
    assert.equal((await Analysis.findById(record.id)).rawJDText, rawJDText);
    const fetched = await request(`${path}/${record.id}`, { cookie });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.analysis.rawJDText, rawJDText);
    assert.equal(fetched.headers.get('cache-control'), 'no-store');
    assert.equal((await request(`${path}/${record.id}`, { cookie: cookieFor(other) })).status, 404);
    assert.equal((await request(`${path}/invalid`, { cookie })).status, 404);
    assert.equal((await request(`${path}/${record.id}`)).status, 401);
    // Immutable fields survive ordinary document and query updates.
    await Analysis.updateOne({ _id: record.id }, { $set: { rawJDText: 'replacement '.repeat(12), recruiter: other.id } });
    const stored = await Analysis.findById(record.id);
    stored.rawJDText = 'another replacement '.repeat(10);
    await stored.save();
    assert.equal((await Analysis.findById(record.id)).rawJDText, rawJDText);
    assert.equal(String((await Analysis.findById(record.id)).recruiter), owner.id);
    await assert.rejects(Analysis.replaceOne({ _id: record.id }, { recruiter: owner.id, rawJDText: 'replacement '.repeat(12) }), /replacement is not allowed/);
    // Valid Unicode maximum exceeds the legacy 32 KB JSON parser allowance.
    const unicode = '界'.repeat(20000);
    const large = await request(path, { cookie, body: { rawJDText: unicode } });
    assert.equal(large.status, 201);
    assert.equal((await Analysis.findById(large.body.analysis.id)).rawJDText, unicode);
    assert.equal((await request(path, { cookie, body: { rawJDText: 'x'.repeat(100) } })).status, 201);
    await User.deleteOne({ _id: owner.id });
    const count = await Analysis.countDocuments({ recruiter: owner.id });
    await assert.rejects(require('../src/services/analysis.service').createAnalysis(owner.id, rawJDText), { statusCode: 401 });
    assert.equal(await Analysis.countDocuments({ recruiter: owner.id }), count);
    assert.equal((await request(`${path}/${record.id}`, { cookie })).status, 401);
});

test('HTTP: deletion requires confirmation, removes only the signed-in account, and invalidates sessions', async () => {
    const Report = require('../src/models/interviewReport.model');
    const State = require('../src/models/oauthState.model');
    const owner = await User.create({ username: 'delete-owner', email: 'delete@example.com', password: 'ExamplePass9', isVerified: true });
    const other = await User.create({ username: 'delete-other', email: 'keep@example.com', password: 'ExamplePass9', isVerified: true });
    await Report.create([{ user: owner.id, title: 'Private', jobDescription: 'Role', resume: 'Personal resume' },
        { user: other.id, title: 'Keep', jobDescription: 'Role' }]);
    await State.create({ _id: 'delete-link', browserHash: 'synthetic', linkUserId: owner.id, expiresAt: new Date(Date.now() + 60000) });
    const login = await request('/api/auth/login', { body: { email: owner.email, password: 'ExamplePass9' } });
    const cookie = cookieFrom(login);
    assert.equal((await request('/api/auth/delete-account', { body: { confirmation: 'DELETE' } })).status, 401);
    assert.equal((await request('/api/auth/delete-account', { body: {}, cookie })).status, 400);
    assert.equal((await request('/api/auth/delete-account', { body: { confirmation: 'DELETE' }, cookie, headers: { Origin: 'https://untrusted.example' } })).status, 403);
    assert.ok(await User.findById(owner.id));
    const deleted = await request('/api/auth/delete-account', { cookie, body: { confirmation: 'DELETE', userId: other.id } });
    assert.equal(deleted.status, 200);
    assert.match(deleted.headers.get('set-cookie'), /token=;/);
    assert.equal(await User.findById(owner.id), null);
    assert.equal(await Report.countDocuments({ user: owner.id }), 0);
    assert.equal(await State.countDocuments({ linkUserId: owner.id }), 0);
    assert.ok(await User.findById(other.id));
    assert.equal(await Report.countDocuments({ user: other.id }), 1);
    assert.equal((await request('/api/auth/get-me', { cookie })).status, 401);
    await assert.rejects(require('../src/services/account.service').saveReportForUser(owner.id, { title: 'Late result', jobDescription: 'Role' }), { statusCode: 401 });
    assert.equal(await Report.countDocuments({ user: owner.id }), 0);
});

test('account deletion rolls back if related-data cleanup fails, including for Google-only accounts', async () => {
    const Report = require('../src/models/interviewReport.model');
    const owner = await User.create({ username: 'delete-google', email: 'delete-google@example.com', googleId: 'deletion-google', isVerified: true });
    await Report.create({ user: owner.id, title: 'Keep on failure', jobDescription: 'Role' });
    const original = Report.deleteMany;
    try {
        Report.deleteMany = async () => { throw new Error('Synthetic cleanup failure'); };
        await assert.rejects(require('../src/services/account.service').deleteAccount(owner.id), /Synthetic cleanup failure/);
    } finally { Report.deleteMany = original; }
    assert.ok(await User.findById(owner.id));
    assert.equal(await Report.countDocuments({ user: owner.id }), 1);
    await require('../src/services/account.service').deleteAccount(owner.id);
    assert.equal(await User.findById(owner.id), null);
});

test('HTTP: production cookie login, refresh and logout work with the first-party frontend origin', async () => {
    const original = { NODE_ENV: process.env.NODE_ENV, COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE,
        FRONTEND_URL: process.env.FRONTEND_URL, BACKEND_URL: process.env.BACKEND_URL };
    // CORS is captured at app construction, so keep its configured origin for
    // requests while testing the production controller's cookie configuration.
    const origin = process.env.FRONTEND_URL;
    Object.assign(process.env, { NODE_ENV: 'production', COOKIE_SAME_SITE: 'lax',
        FRONTEND_URL: 'https://app.example.com', BACKEND_URL: 'https://backend.example.net' });
    try {
        await User.create({ username: 'production-cookie', email: 'production@example.com', password: 'ExamplePass9', isVerified: true });
        // Exercise real controllers and auth middleware through a separate app
        // configured with the production origin at creation time.
        const appPath = require.resolve('../src/app');
        delete require.cache[appPath];
        const app = require('../src/app');
        const productionServer = await new Promise(resolve => {
            const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
        });
        const previousBase = apiBase;
        apiBase = `http://127.0.0.1:${productionServer.address().port}`;
        try {
            const login = await request('/api/auth/login', { body: { email: 'production@example.com', password: 'ExamplePass9' } });
            assert.equal(login.status, 200);
            const cookie = login.headers.get('set-cookie');
            assert.match(cookie, /HttpOnly/);
            assert.match(cookie, /Secure/);
            assert.match(cookie, /SameSite=Lax/);
            assert.doesNotMatch(cookie, /Domain=/i);
            assert.equal(login.headers.get('access-control-allow-origin'), 'https://app.example.com');
            assert.equal((await request('/api/auth/get-me', { cookie: cookieFrom(login) })).status, 200);
            assert.equal((await request('/api/auth/logout', { body: {}, cookie: cookieFrom(login) })).status, 200);
            assert.equal((await request('/api/auth/get-me', { cookie: cookieFrom(login) })).status, 401);
        } finally {
            apiBase = previousBase;
            await new Promise(resolve => productionServer.close(resolve));
        }
    } finally {
        Object.assign(process.env, original);
        assert.equal(process.env.FRONTEND_URL, origin);
    }
});

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
