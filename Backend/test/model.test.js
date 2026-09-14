const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/user.model');

test('local, Google, and combined credentials are independently representable', async () => {
    for (const credentials of [
        { password: 'ExamplePass9' },
        { googleId: 'google-subject' },
        { password: 'ExamplePass9', googleId: 'google-subject', authProvider: 'google' },
    ]) {
        await new User({ username: 'example', email: ' USER@example.com ', ...credentials }).validate();
    }
    await assert.rejects(new User({ username: 'example', email: 'user@example.com' }).validate());
    assert(User.schema.indexes().some(([fields, options]) => fields.googleId && options.unique));
});
