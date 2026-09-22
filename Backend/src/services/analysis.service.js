const mongoose = require('mongoose');
const User = require('../models/user.model');
const Analysis = require('../models/analysis.model');
const AppError = require('../utils/AppError');

async function createAnalysis(recruiterId, rawJDText, pdf = null) {
    return mongoose.connection.transaction(async session => {
        // Serialize creation against account deletion, as existing reports do.
        const owner = await User.findOneAndUpdate({ _id: recruiterId, isVerified: true },
            { $inc: { __v: 1 } }, { session });
        if (!owner) throw new AppError('Please sign in again.', 401);
        const [analysis] = await Analysis.create([{ recruiter: recruiterId, rawJDText, sourceType: pdf ? 'pdf' : 'text', status: 'draft',
            ...(pdf ? { originalFile: pdf, extractionStatus: 'completed' } : {}) }], { session });
        return analysis;
    });
}

async function getAnalysis(recruiterId, analysisId) {
    if (!/^[a-f\d]{24}$/i.test(analysisId)) throw new AppError('Analysis not found.', 404);
    const analysis = await Analysis.findOne({ _id: analysisId, recruiter: recruiterId });
    if (!analysis) throw new AppError('Analysis not found.', 404);
    return analysis;
}

async function createPdfAnalysis(recruiterId, file) {
    const storage = require('./jd-storage.service');
    const original = await storage.store(file);
    try {
        const text = await storage.extract(file.buffer);
        const validation = require('../validations/analysis.validations').rawJDText.safeParse(text);
        if (!validation.success) throw new AppError('Extracted JD must contain 100–20,000 characters. Scanned PDFs need OCR; paste the JD text instead.', 422);
        return await createAnalysis(recruiterId, text, original);
    } catch (error) {
        await storage.remove(original.key);
        throw error;
    }
}
const pendingExtractions = new Map();
async function extractRequirements(recruiterId, analysisId) {
    const analysis = await getAnalysis(recruiterId, analysisId);
    if (analysis.structuredJD) return analysis;
    const key = `${recruiterId}:${analysisId}`;
    if (pendingExtractions.has(key)) return pendingExtractions.get(key);
    const task = (async () => {
        const result = await require('./jd-ai.service').extract(analysis.rawJDText);
        const validated = require('../validations/jd-requirements.validations').extractionResult.safeParse(result);
        if (!validated.success) throw new AppError('JD extraction returned invalid requirements. Please retry.', 502);
        return mongoose.connection.transaction(async session => {
            const owner = await User.findOneAndUpdate({ _id: recruiterId, isVerified: true }, { $inc: { __v: 1 } }, { session });
            if (!owner) throw new AppError('Please sign in again.', 401);
            const current = await Analysis.findOne({ _id: analysisId, recruiter: recruiterId }).session(session);
            if (!current) throw new AppError('Analysis not found.', 404);
            if (current.structuredJD) return current;
            Object.assign(current, validated.data);
            await current.save({ session });
            return current;
        });
    })();
    pendingExtractions.set(key, task);
    try { return await task; } finally { pendingExtractions.delete(key); }
}

async function reviewRequirements(recruiterId, analysisId) {
    const analysis = await getAnalysis(recruiterId, analysisId);
    if (!analysis.structuredJD) throw new AppError('Extract requirements before marking them reviewed.', 409);
    if (analysis.requirementsReviewedAt) return analysis;
    return Analysis.findOneAndUpdate({ _id: analysisId, recruiter: recruiterId },
        { $set: { requirementsReviewedAt: new Date() } }, { new: true, runValidators: true });
}
module.exports = { createAnalysis, getAnalysis, createPdfAnalysis, extractRequirements, reviewRequirements };
