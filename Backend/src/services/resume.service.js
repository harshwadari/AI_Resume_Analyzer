const mongoose = require('mongoose');
const Resume = require('../models/resume.model');
const Analysis = require('../models/analysis.model');
const User = require('../models/user.model');
const { getAnalysis } = require('./analysis.service');
const storage = require('./resume-storage.service');
const AppError = require('../utils/AppError');

async function upload(recruiter, analysis, files) {
    await getAnalysis(recruiter, analysis);
    for (const file of files) {
        if (file.path) await storage.validatePath(file.path, file.originalname, file.size);
        else storage.validate(file);
    }
    const stored = [];
    try {
        for (const file of files) stored.push(await storage.store(file));
        return await mongoose.connection.transaction(async session => {
            const owner = await User.findOneAndUpdate({ _id: recruiter, isVerified: true }, { $inc: { __v: 1 } }, { session });
            if (!owner) throw new AppError('Please sign in again.', 401);
            const parent = await Analysis.findOneAndUpdate({ _id: analysis, recruiter }, { $inc: { __v: 1 } }, { session });
            if (!parent) throw new AppError('Analysis not found.', 404);
            return Resume.create(stored.map(file => ({ ...file, analysis, recruiter, processingStatus: 'UPLOADED' })), { session, ordered: true });
        });
    } catch (error) {
        const cleaned = await Promise.allSettled(stored.map(file => storage.remove(file.storageReference)));
        if (cleaned.some(result => result.status === 'rejected')) require('../utils/securityLog').logFailure('Resume upload cleanup failed', new Error('Private file cleanup requires attention'));
        throw error;
    }
}

async function list(recruiter, analysis, page = '1') {
    await getAnalysis(recruiter, analysis);
    if (typeof page !== 'string' || !/^[1-9]\d{0,5}$/.test(page)) throw new AppError('Invalid resume page.', 400);
    const pageSize = 50;
    const query = { recruiter, analysis };
    const [resumes, total] = await Promise.all([
        Resume.find(query).sort({ createdAt: 1, _id: 1 }).skip((Number(page) - 1) * pageSize).limit(pageSize),
        Resume.countDocuments(query),
    ]);
    return { resumes, total, page: Number(page), pageSize };
}
module.exports = { upload, list };
