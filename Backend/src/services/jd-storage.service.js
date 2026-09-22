const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Worker } = require('node:worker_threads');
const AppError = require('../utils/AppError');

function storageRoot() {
    if (process.env.NODE_ENV === 'production' && !process.env.JD_STORAGE_DIR)
        throw new AppError('JD file storage is not configured.', 503);
    return path.resolve(process.env.JD_STORAGE_DIR || path.join(__dirname, '../../.private/jds'));
}
function filePath(key) {
    if (!/^[a-f0-9-]{36}\.pdf$/.test(key)) throw new AppError('Original PDF not found.', 404);
    return path.join(storageRoot(), key);
}
async function store(file) {
    if (!file || !/\.pdf$/i.test(file.originalname) || file.mimetype !== 'application/pdf' ||
        !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-')))
        throw new AppError('Upload a valid PDF job description.', 400);
    const key = `${randomUUID()}.pdf`;
    const name = file.originalname.replace(/\\/g, '/').split('/').pop().replace(/[^a-zA-Z0-9._ -]/g, '_').slice(-120) || 'job-description.pdf';
    await fs.mkdir(storageRoot(), { recursive: true, mode: 0o700 });
    await fs.writeFile(filePath(key), file.buffer, { flag: 'wx', mode: 0o600 });
    return { key, name, size: file.size };
}
async function remove(key) { await fs.unlink(filePath(key)); }
function extract(buffer) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'jd-pdf.worker.js'), {
            workerData: buffer, resourceLimits: { maxOldGenerationSizeMb: 128 },
        });
        let settled = false;
        const finish = (error, text) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            void worker.terminate();
            if (error) reject(new AppError('Could not extract this PDF. Use a readable, unencrypted PDF of at most 50 pages, or paste the JD text.', 422));
            else resolve(text);
        };
        const timer = setTimeout(() => finish(true), 15000);
        worker.once('message', result => finish(result.error, result.text));
        worker.once('error', () => finish(true));
        worker.once('exit', () => finish(true));
    });
}
module.exports = { store, remove, extract, filePath };
