const service = require('../services/analysis.service');
const asyncHandler = require('../utils/asyncHandler');

function serialize(analysis) {
    return { id: analysis.id, recruiter: String(analysis.recruiter), rawJDText: analysis.rawJDText,
        sourceType: analysis.sourceType, status: analysis.status, createdAt: analysis.createdAt };
}

exports.createAnalysis = asyncHandler(async (req, res) => {
    const analysis = await service.createAnalysis(req.user.id, req.body.rawJDText);
    res.status(201).json({ success: true, analysis: serialize(analysis) });
});

exports.getAnalysis = asyncHandler(async (req, res) => {
    const analysis = await service.getAnalysis(req.user.id, req.params.analysisId);
    res.json({ success: true, analysis: serialize(analysis) });
});
