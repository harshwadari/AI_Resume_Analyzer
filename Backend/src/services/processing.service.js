const mongoose = require('mongoose');
const Analysis = require('../models/analysis.model');
const User = require('../models/user.model');
const Resume = require('../models/resume.model');
const Job = require('../models/processingJob.model');
const { getAnalysis } = require('./analysis.service');
const AppError = require('../utils/AppError');

async function progress(recruiter, analysisId) {
    const analysis = await getAnalysis(recruiter, analysisId);
    if (!analysis.processingJobId) return { job: null };
    const job = await Job.findOne({ _id: analysis.processingJobId, recruiter, analysis: analysisId });
    if (!job) return { job: null };
    const groups = await Resume.aggregate([
        { $match: { _id: { $in: job.resumeIds }, jobId: job._id, recruiter: job.recruiter } },
        { $group: { _id: '$processingStatus', count: { $sum: 1 } } },
    ]);
    const counts = Object.fromEntries(groups.map(item => [item._id, item.count]));
    const processed = counts.PROCESSED || 0, failed = counts.FAILED || 0, total = job.resumeIds.length;
    const completed = processed + failed;
    const status = completed === total ? failed ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED' : job.status;
    return { job: { id: job.id, total, completed, processed, failed, processing: counts.PROCESSING || 0,
        queued: counts.UPLOADED || 0, status, dispatchError: completed === total ? null : job.dispatchError || null, createdAt: job.createdAt } };
}

async function start(recruiter, analysisId, retryFailed = false) {
    await getAnalysis(recruiter, analysisId);
    const job = await mongoose.connection.transaction(async session => {
        const owner = await User.findOneAndUpdate({ _id: recruiter, isVerified: true }, { $inc: { __v: 1 } }, { session });
        if (!owner) throw new AppError('Please sign in again.', 401);
        const analysis = await Analysis.findOneAndUpdate({ _id: analysisId, recruiter }, { $inc: { __v: 1 } }, { session });
        if (!analysis) throw new AppError('Analysis not found.', 404);
        if (analysis.processingJobId) {
            const active = await Job.findById(analysis.processingJobId).session(session);
            if (active && await Resume.exists({ jobId: active._id, processingStatus: { $in: ['UPLOADED', 'PROCESSING'] } }).session(session)) return active;
        }
        const selected = await Resume.find({ analysis: analysisId, recruiter, processingStatus: retryFailed ? 'FAILED' : 'UPLOADED' }).select('_id').session(session);
        if (!selected.length) {
            if (analysis.processingJobId) return Job.findById(analysis.processingJobId).session(session);
            throw new AppError('Upload resumes before starting processing.', 409);
        }
        if (selected.length > 10000) throw new AppError('A processing job supports at most 10,000 resumes.', 400);
        const [created] = await Job.create([{ analysis: analysisId, recruiter, resumeIds: selected.map(item => item._id) }], { session });
        await Resume.updateMany({ _id: { $in: created.resumeIds }, recruiter }, { $set: { jobId: created._id, processingStatus: 'UPLOADED', attempts: 0 },
            $unset: { processingError: '', publishedAt: '', leaseUntil: '', claimToken: '', nextAttemptAt: '' } }, { session });
        analysis.processingJobId = created._id; await analysis.save({ session });
        return created;
    });
    // Mongo is the durable publication intent. Python reconciliation recovers failed sends.
    try {
        await require('./ai-client.service').request('/v1/jobs', { body: { jobId: job.id }, timeout: 10000 });
        await Job.updateOne({ _id: job._id }, { $unset: { dispatchError: '' } });
    } catch {
        await Job.updateOne({ _id: job._id }, { $set: { dispatchError: 'Waiting for the processing queue. Retrying publication is safe.' } });
    }
    return progress(recruiter, analysisId);
}
module.exports = { start, progress };
