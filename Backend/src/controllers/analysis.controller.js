const service = require('../services/analysis.service');
const asyncHandler = require('../utils/asyncHandler');

function serialize(analysis) {
    return { id: analysis.id, recruiter: String(analysis.recruiter), rawJDText: analysis.rawJDText,
        sourceType: analysis.sourceType, status: analysis.status, createdAt: analysis.createdAt,
        ...(analysis.structuredJD ? { structuredJD: analysis.structuredJD, parserVersion: analysis.parserVersion,
            modelName: analysis.modelName, extractedAt: analysis.extractedAt, requirementsReviewedAt: analysis.requirementsReviewedAt || null } : {}),
        ...(analysis.originalFile ? { originalFile: { name: analysis.originalFile.name, size: analysis.originalFile.size }, extractionStatus: analysis.extractionStatus } : {}) };
}

exports.createAnalysis = asyncHandler(async (req, res) => {
    const analysis = await service.createAnalysis(req.user.id, req.body.rawJDText);
    res.status(201).json({ success: true, analysis: serialize(analysis) });
});

exports.getAnalysis = asyncHandler(async (req, res) => {
    const analysis = await service.getAnalysis(req.user.id, req.params.analysisId);
    res.json({ success: true, analysis: serialize(analysis) });
});

exports.extractRequirements = asyncHandler(async (req, res) => {
    res.json({ success: true, analysis: serialize(await service.extractRequirements(req.user.id, req.params.analysisId)) });
});
exports.reviewRequirements = asyncHandler(async (req, res) => {
    res.json({ success: true, analysis: serialize(await service.reviewRequirements(req.user.id, req.params.analysisId)) });
});

exports.createPdfAnalysis = asyncHandler(async (req, res) => {
    const analysis = await service.createPdfAnalysis(req.user.id, req.file);
    res.status(201).json({ success: true, analysis: serialize(analysis) });
});

exports.downloadOriginal = asyncHandler(async (req, res, next) => {
    const analysis = await service.getAnalysis(req.user.id, req.params.analysisId);
    if (!analysis.originalFile) throw new (require('../utils/AppError'))('Original PDF not found.', 404);
    res.type('application/pdf');
    res.download(require('../services/jd-storage.service').filePath(analysis.originalFile.key), analysis.originalFile.name, error => {
        if (error && !res.headersSent) next(new (require('../utils/AppError'))('Original PDF is unavailable.', 404));
    });
});
