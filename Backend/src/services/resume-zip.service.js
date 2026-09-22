const fs = require('node:fs/promises');
const { createWriteStream } = require('node:fs');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const yauzl = require('yauzl');
const crc32 = require('node:zlib').crc32 || require('yauzl/crc32');
const AppError = require('../utils/AppError');
const storage = require('./resume-storage.service');
const resumes = require('./resume.service');
const LIMIT = 100 * 1024 * 1024;

async function discover(archive, directory) {
    let zip;
    const files = [], rejected = [], seen = new Set();
    let totalFiles = 0, expanded = 0, actual = 0;
    const signal = AbortSignal.timeout(45000);
    try {
        const handle = await fs.open(archive, 'r');
        const header = Buffer.alloc(4);
        try { await handle.read(header, 0, 4, 0); } finally { await handle.close(); }
        if (!header.equals(Buffer.from([80, 75, 3, 4])) && !header.equals(Buffer.from([80, 75, 5, 6]))) throw new Error('Invalid ZIP signature');
        zip = await new Promise((resolve, reject) => yauzl.open(archive, { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true }, (error, value) => error ? reject(error) : resolve(value)));
        if (zip.entryCount > 500) throw new Error('Too many entries');
        for await (const entry of zip.eachEntry()) {
            signal.throwIfAborted();
            const name = entry.fileName;
            // Never join archive names to disk paths. Also reject ambiguous Windows paths.
            if (name.length > 500 || /[\x00-\x1f:]/.test(name) || name.split('/').some(part => part === '..' || /[. ]$/.test(part))) throw new Error('Unsafe archive path');
            if (name.endsWith('/')) continue;
            totalFiles++;
            expanded += entry.uncompressedSize;
            if (expanded > LIMIT || entry.uncompressedSize / Math.max(1, entry.compressedSize) > 100) throw new Error('Archive expansion limit exceeded');
            const normalized = name.normalize('NFC').toLowerCase();
            let reason = null;
            const type = (entry.externalFileAttributes >>> 16) & 0xf000;
            if (type && type !== 0x8000) reason = 'Links and special files are not supported.';
            else if (entry.generalPurposeBitFlag & 1) reason = 'Encrypted entries are not supported.';
            else if (seen.has(normalized)) reason = 'Duplicate archive path.';
            else if (!/\.pdf$/i.test(name)) reason = 'Only PDF files are supported.';
            else if (entry.uncompressedSize > 5 * 1024 * 1024) reason = 'PDF exceeds 5 MB.';
            else if (![0, 8].includes(entry.compressionMethod)) reason = 'Unsupported compression.';
            seen.add(normalized);
            if (reason) { rejected.push({ name, reason }); continue; }
            const target = path.join(directory, `${randomUUID()}.pdf`);
            let size = 0, checksum = 0;
            try {
                const stream = await zip.openReadStreamPromise(entry);
                const meter = new Transform({ transform(chunk, encoding, callback) {
                    size += chunk.length; actual += chunk.length;
                    if (size > 5 * 1024 * 1024 || actual > LIMIT) return callback(new Error('Expansion limit exceeded'));
                    checksum = crc32(chunk, checksum);
                    callback(null, chunk);
                } });
                await pipeline(stream, meter, createWriteStream(target, { flags: 'wx', mode: 0o600 }), { signal });
                if (checksum !== entry.crc32) throw new Error('Checksum mismatch');
                await storage.validatePath(target, name, size);
                files.push({ path: target, originalname: path.posix.basename(name), size, mimetype: 'application/pdf' });
            } catch (error) {
                if (signal.aborted || actual > LIMIT || size > 5 * 1024 * 1024) throw error;
                await fs.unlink(target).catch(() => {});
                rejected.push({ name, reason: 'Invalid or damaged PDF entry.' });
            }
        }
        return { totalFiles, validPDFs: files.length, rejected, files };
    } catch {
        throw new AppError('ZIP rejected: invalid archive, unsafe paths, or safety limits exceeded (500 entries, 100 MB expanded, 100:1 compression ratio).', 400);
    } finally {
        if (zip?.isOpen) await new Promise(resolve => { zip.once('close', resolve); zip.close(); });
    }
}
async function ingest(recruiter, analysis, archive, directory) {
    const report = await discover(archive, directory);
    const records = report.files.length ? await resumes.upload(recruiter, analysis, report.files) : [];
    return { totalFiles: report.totalFiles, validPDFs: report.validPDFs, rejected: report.rejected, records };
}
module.exports = { discover, ingest };
