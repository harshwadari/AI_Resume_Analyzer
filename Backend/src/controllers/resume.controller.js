const service = require('../services/resume.service');
const asyncHandler = require('../utils/asyncHandler');
const { getAnalysis } = require('../services/analysis.service');

const serialize = resume => ({ id: resume.id, analysisId: String(resume.analysis), recruiterId: String(resume.recruiter),
    originalFilename: resume.originalFilename, size: resume.size, processingStatus: resume.processingStatus, createdAt: resume.createdAt,
    jobId: resume.jobId ? String(resume.jobId) : null, attempts: resume.attempts || 0, processingError: resume.processingError || null });

exports.authorizeAnalysis = asyncHandler(async (req, res, next) => {
    await getAnalysis(req.user.id, req.params.analysisId);
    next();
});
exports.upload = asyncHandler(async (req, res) => {
    const records = await service.upload(req.user.id, req.params.analysisId, req.files);
    res.status(201).json({ success: true, resumes: records.map(serialize) });
});
exports.list = asyncHandler(async (req, res) => {
    const result = await service.list(req.user.id, req.params.analysisId, req.query.page);
    res.json({ success: true, ...result, resumes: result.resumes.map(serialize) });
});
exports.startProcessing = asyncHandler(async (req, res) => {
    res.status(202).json({ success: true, ...await require('../services/processing.service').start(req.user.id, req.params.analysisId, req.body.retryFailed) });
});
exports.processingProgress = asyncHandler(async (req, res) => {
    res.json({ success: true, ...await require('../services/processing.service').progress(req.user.id, req.params.analysisId) });
});
exports.uploadZip = asyncHandler(async (req, res) => {
    let result;
    try {
        result = await require('../services/resume-zip.service').ingest(req.user.id, req.params.analysisId, req.file.path, req.zipDirectory);
    } finally { await require('../middlewares/resume-zip.middleware').cleanup(req.zipDirectory); }
    res.status(201).json({ success: true, totalFiles: result.totalFiles, validPDFs: result.validPDFs,
        rejected: result.rejected, resumes: result.records.map(serialize) });
});
