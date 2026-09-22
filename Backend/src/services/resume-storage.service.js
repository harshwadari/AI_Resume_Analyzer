const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const AppError = require('../utils/AppError');

function root() {
    if (process.env.NODE_ENV === 'production' && !process.env.RESUME_STORAGE_DIR)
        throw new AppError('Resume storage is not configured.', 503);
    return path.resolve(process.env.RESUME_STORAGE_DIR || path.join(__dirname, '../../.private/resumes'));
}
function filePath(key) {
    if (!/^[a-f0-9-]{36}\.pdf$/.test(key)) throw new AppError('Resume file not found.', 404);
    return path.join(root(), key);
}
function validate(file) {
    if (!/\.pdf$/i.test(file.originalname) || file.mimetype !== 'application/pdf' ||
        !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-')) || !file.buffer.subarray(-1024).includes(Buffer.from('%%EOF')))
        throw new AppError('Each resume must be a PDF with a valid header and end marker.', 400);
}
async function store(file) {
    const key = `${randomUUID()}.pdf`;
    await fs.mkdir(root(), { recursive: true, mode: 0o700 });
    try {
        if (file.path) await fs.copyFile(file.path, filePath(key), require('node:fs').constants.COPYFILE_EXCL);
        else await fs.writeFile(filePath(key), file.buffer, { flag: 'wx', mode: 0o600 });
    }
    catch (error) {
        if (error.code !== 'EEXIST') await fs.unlink(filePath(key)).catch(() => {});
        throw error;
    }
    // Metadata only: never use a submitted name as a disk path.
    const name = file.originalname.replace(/\\/g, '/').split('/').pop().replace(/[\x00-\x1f\x7f]/g, '_').slice(-255);
    return { storageReference: key, originalFilename: name || 'resume.pdf', size: file.size };
}
async function remove(key) { await fs.unlink(filePath(key)); }
async function validatePath(target, name, size) {
    if (size > 5 * 1024 * 1024) throw new AppError('PDF exceeds 5 MB.', 400);
    const handle = await fs.open(target, 'r');
    try {
        const header = Buffer.alloc(5), tail = Buffer.alloc(Math.min(1024, size));
        await handle.read(header, 0, 5, 0);
        await handle.read(tail, 0, tail.length, Math.max(0, size - tail.length));
        validate({ originalname: name, mimetype: 'application/pdf', buffer: Buffer.concat([header, tail]) });
    } finally { await handle.close(); }
}
module.exports = { validate, validatePath, store, remove, filePath };
