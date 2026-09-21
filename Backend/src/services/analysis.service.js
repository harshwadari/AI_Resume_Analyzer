const mongoose = require('mongoose');
const User = require('../models/user.model');
const Analysis = require('../models/analysis.model');
const AppError = require('../utils/AppError');

async function createAnalysis(recruiterId, rawJDText) {
    return mongoose.connection.transaction(async session => {
        // Serialize creation against account deletion, as existing reports do.
        const owner = await User.findOneAndUpdate({ _id: recruiterId, isVerified: true },
            { $inc: { __v: 1 } }, { session });
        if (!owner) throw new AppError('Please sign in again.', 401);
        const [analysis] = await Analysis.create([{ recruiter: recruiterId, rawJDText, sourceType: 'text', status: 'draft' }], { session });
        return analysis;
    });
}

async function getAnalysis(recruiterId, analysisId) {
    if (!/^[a-f\d]{24}$/i.test(analysisId)) throw new AppError('Analysis not found.', 404);
    const analysis = await Analysis.findOne({ _id: analysisId, recruiter: recruiterId });
    if (!analysis) throw new AppError('Analysis not found.', 404);
    return analysis;
}

module.exports = { createAnalysis, getAnalysis };
