const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

test('MongoDB uses explicit resolver configuration and still propagates connection failures', async () => {
    const calls = [];
    const connect = load('src/config/database.js', {
        'node:dns': { setServers: servers => calls.push(Array.from(servers)) },
        mongoose: { connect: async () => { calls.push('connect'); throw new Error('offline'); } },
    }, { MONGO_URI: 'mongodb://synthetic', MONGO_DNS_SERVERS: '1.1.1.1, 8.8.8.8' });
    await assert.rejects(connect(), /offline/);
    assert.deepEqual(calls, [['1.1.1.1', '8.8.8.8'], 'connect']);
});

test('MongoDB keeps system DNS when no override is configured', async () => {
    const connect = load('src/config/database.js', {
        'node:dns': { setServers: () => assert.fail('Unexpected DNS override') },
        mongoose: { connect: async () => 'connected' },
    }, { MONGO_URI: 'mongodb://synthetic' });
    assert.equal(await connect(), 'connected');
});
