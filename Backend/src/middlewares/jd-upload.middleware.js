const multer = require('multer');
const AppError = require('../utils/AppError');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
    fileFilter: (req, file, callback) => callback(
        /\.pdf$/i.test(file.originalname) && file.mimetype === 'application/pdf' ? null : new AppError('Only PDF files are supported.', 400), true),
}).single('jd');
module.exports = (req, res, next) => upload(req, res, error => {
    if (error) return next(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 'JD PDF must be 5 MB or smaller.' : 'Upload exactly one PDF in the jd field, with no additional fields.', error.code === 'LIMIT_FILE_SIZE' ? 413 : 400));
    if (!req.file) return next(new AppError('Choose a JD PDF to upload.', 400));
    next();
});
