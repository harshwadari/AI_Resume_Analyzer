const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');
const profile = { id: 'subject', emails: [{ value: 'user@gmail.com', verified: true }] };

test('repeat Google login uses provider ID even when its email changes', async () => {
    const existing = { _id: 'existing', googleId: 'subject', isVerified: true };
    const { resolveGoogleUser } = load('src/services/google-auth.service.js', { '../models/user.model': {
        findOne: async q => { assert.equal(q.googleId, 'subject'); return existing; },
    } });
    assert.equal(await resolveGoogleUser(profile), existing);
    assert.equal(await resolveGoogleUser({ ...profile, emails: [{ value: 'changed@gmail.com', verified: true }] }), existing);
    await assert.rejects(resolveGoogleUser(profile, 'another-account'), /already linked/);
});

test('Google links a trusted verified local account without replacing its password/provider', async () => {
    const local = { _id: 'local', email: 'user@gmail.com', password: 'original-hash', authProvider: 'local', isVerified: true };
    let update;
    const { resolveGoogleUser } = load('src/services/google-auth.service.js', { '../models/user.model': {
        findOne: async q => q.googleId ? null : local,
        findOneAndUpdate: async (q, u) => { update = u; return { ...local, ...u.$set }; },
    } });
    const linked = await resolveGoogleUser(profile);
    assert.equal(linked.password, 'original-hash');
    assert.equal(update.$set.authProvider, undefined);
    assert.equal(linked.googleId, 'subject');
});

test('Google rejects unverified email and conflicting identities', async () => {
    const { resolveGoogleUser } = load('src/services/google-auth.service.js', { '../models/user.model': {
        findOne: async q => q.googleId ? null : { _id: 'local', googleId: 'different', isVerified: true },
    } });
    await assert.rejects(resolveGoogleUser({ ...profile, emails: [{ value: 'user@gmail.com', verified: false }] }), /verified/);
    await assert.rejects(resolveGoogleUser(profile), /conflicts/);
});

test('third-party Google email requires explicit linking to the authenticated account', async () => {
    const local = { _id: 'local', isVerified: true };
    const { resolveGoogleUser } = load('src/services/google-auth.service.js', { '../models/user.model': {
        findOne: async q => q.googleId ? null : local,
        findOneAndUpdate: async () => ({ ...local, googleId: 'subject' }),
    } });
    const external = { ...profile, emails: [{ value: 'user@example.com', verified: true }] };
    await assert.rejects(resolveGoogleUser(external), /Sign in/);
    assert.equal((await resolveGoogleUser(external, 'local')).googleId, 'subject');
    await assert.rejects(resolveGoogleUser(external, 'someone-else'), /Sign in/);
});
