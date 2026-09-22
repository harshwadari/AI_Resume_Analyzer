const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true, immutable: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, immutable: true },
    originalFilename: { type: String, required: true, maxlength: 255, immutable: true },
    storageReference: { type: String, required: true, immutable: true, select: false },
    size: { type: Number, required: true, immutable: true },
    processingStatus: { type: String, enum: ['UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED'], default: 'UPLOADED', required: true },
    jobId: mongoose.Schema.Types.ObjectId,
    attempts: { type: Number, default: 0 },
    processingError: String,
    processedAt: Date,
    parserVersion: String,
    rawText: { type: String, select: false },
    publishedAt: Date,
    nextAttemptAt: Date,
    leaseUntil: Date,
    claimToken: String,
}, { timestamps: true });
schema.index({ recruiter: 1, analysis: 1, createdAt: 1, _id: 1 });
module.exports = mongoose.model('Resume', schema);
