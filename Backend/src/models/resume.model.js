const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
    pageNumber: { type: Number, required: true, min: 1, max: 50 },
    text: { type: String, default: '', maxlength: 100000 },
}, { _id: false });
const metadataSchema = new mongoose.Schema({
    pageCount: { type: Number, required: true, min: 1, max: 50 },
    format: String, title: String, author: String, subject: String, keywords: String,
    creator: String, producer: String, creationDate: String, modDate: String, trapped: String,
}, { _id: false });

const schema = new mongoose.Schema({
    analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true, immutable: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, immutable: true },
    originalFilename: { type: String, required: true, maxlength: 255, immutable: true },
    storageReference: { type: String, required: true, immutable: true, select: false },
    size: { type: Number, required: true, immutable: true },
    processingStatus: { type: String, enum: ['UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED', 'OCR_REQUIRED'], default: 'UPLOADED', required: true },
    jobId: mongoose.Schema.Types.ObjectId,
    attempts: { type: Number, default: 0 },
    processingError: String,
    processedAt: Date,
    parserVersion: String,
    candidateProfile: { type: require('./candidateProfile.schema').profile, select: false },
    resumeChunks: { type: [require('./candidateProfile.schema').chunk], default: undefined, select: false },
    profileParserVersion: String,
    profileModel: String,
    profileModelVersion: String,
    profileExtractedAt: Date,
    chunkerVersion: String,
    sourceTextHash: { type: String, select: false },
    extractionMethod: { type: String, enum: ['text', 'ocr'] },
    ocrRequiredPages: { type: [Number], default: undefined, select: false },
    rawText: { type: String, select: false },
    pages: { type: [pageSchema], default: undefined, select: false },
    documentMetadata: { type: metadataSchema, default: undefined, select: false },
    publishedAt: Date,
    nextAttemptAt: Date,
    leaseUntil: Date,
    claimToken: String,
}, { timestamps: true });
schema.index({ recruiter: 1, analysis: 1, createdAt: 1, _id: 1 });
module.exports = mongoose.model('Resume', schema);
