const multer = require('multer');
const AppError = require('../utils/AppError');
const upload = multer({ storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 10, fields: 0, parts: 11 },
    fileFilter: (req, file, callback) => callback(
        /\.pdf$/i.test(file.originalname) && file.mimetype === 'application/pdf' ? null : new AppError('Only resume PDFs are supported.', 400), true),
}).array('resumes', 10);
module.exports = (req, res, next) => upload(req, res, error => {
    if (error) return next(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 'Each resume must be 5 MB or smaller.' : 'Upload 1–10 PDF files using the resumes field only.', error.code === 'LIMIT_FILE_SIZE' ? 413 : 400));
    if (!req.files?.length) return next(new AppError('Choose at least one resume PDF.', 400));
    next();
});
