const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const multer = require('multer');
const AppError = require('../utils/AppError');
const tempRoot = path.join(os.tmpdir(), 'prepwise-resume-imports');
async function cleanup(directory) {
    if (path.dirname(path.resolve(directory)) !== path.resolve(tempRoot) || !path.basename(directory).startsWith('zip-')) throw new Error('Invalid cleanup directory');
    await fs.rm(directory, { recursive: true, force: true });
}
const upload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, req.zipDirectory), filename: (req, file, cb) => cb(null, 'archive.zip') }),
    limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
    fileFilter: (req, file, cb) => cb(/\.zip$/i.test(file.originalname) ? null : new AppError('Choose a ZIP archive.', 400), true),
}).single('archive');
module.exports = async (req, res, next) => {
    try {
        await fs.mkdir(tempRoot, { recursive: true, mode: 0o700 });
        req.zipDirectory = await fs.mkdtemp(path.join(tempRoot, 'zip-'));
        upload(req, res, async error => {
            if (error || !req.file) {
                await cleanup(req.zipDirectory).catch(() => {});
                return next(new AppError(error?.code === 'LIMIT_FILE_SIZE' ? 'ZIP must be 50 MB or smaller.' : 'Upload one ZIP in the archive field only.', error?.code === 'LIMIT_FILE_SIZE' ? 413 : 400));
            }
            next();
        });
    } catch (error) { next(error); }
};
module.exports.cleanup = cleanup;
module.exports.tempRoot = tempRoot;
