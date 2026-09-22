const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const makeZip = require('./zip-fixture');
const pdf = require('./pdf-fixture')();
const { discover } = require('../src/services/resume-zip.service');

async function inspect(bytes, check) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'zip-safety-test-'));
    try {
        const archive = path.join(directory, 'archive.zip'); await fs.writeFile(archive, bytes);
        await check(() => discover(archive, directory));
    } finally {
        assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
        await fs.rm(directory, { recursive: true, force: true });
    }
}
test('ZIP discovers 100 PDFs with sequential disk extraction', async () => {
    await inspect(makeZip(Array.from({ length: 100 }, (_, i) => ({ name: `folder/resume-${i}.pdf`, data: pdf, deflate: true }))), async run => {
        const result = await run(); assert.equal(result.validPDFs, 100); assert.equal(result.totalFiles, 100);
        assert.equal(result.rejected.length, 0);
        assert.equal(new Set(result.files.map(file => file.path)).size, 100);
        assert.deepEqual(await fs.readFile(result.files[99].path), pdf);
    });
});
test('ZIP reports invalid entries, CRC errors, encrypted files, symlinks and duplicate paths', async () => {
    const entries = [
        { name: 'one/resume.pdf', data: pdf }, { name: 'two/resume.pdf', data: pdf },
        { name: 'one/resume.pdf', data: pdf }, { name: 'notes.txt', data: Buffer.from('notes') },
        { name: 'fake.pdf', data: Buffer.from('not a PDF') }, { name: 'crc.pdf', data: pdf, badCrc: true },
        { name: 'secret.pdf', data: pdf, flags: 1 }, { name: 'link.pdf', data: pdf, attributes: 0xa0000000 },
        { name: 'large.pdf', data: Buffer.alloc(5 * 1024 * 1024 + 1) },
    ];
    await inspect(makeZip(entries), async run => { const result = await run(); assert.equal(result.validPDFs, 2); assert.equal(result.rejected.length, 7); });
});
test('ZIP rejects traversal, absolute paths, compression bombs and excessive entry counts', async () => {
    for (const name of ['../escape.pdf', '/absolute.pdf', 'C:/escape.pdf', 'folder\\escape.pdf']) {
        await inspect(makeZip([{ name, data: pdf }]), async run => assert.rejects(run(), { statusCode: 400 }));
    }
    await inspect(makeZip([{ name: 'bomb.pdf', data: Buffer.alloc(1024 * 1024), deflate: true }]), async run => assert.rejects(run(), { statusCode: 400 }));
    await inspect(makeZip(Array.from({ length: 501 }, (_, i) => ({ name: `${i}.txt` }))), async run => assert.rejects(run(), { statusCode: 400 }));
    await inspect(Buffer.from('not a ZIP'), async run => assert.rejects(run(), { statusCode: 400 }));
});
