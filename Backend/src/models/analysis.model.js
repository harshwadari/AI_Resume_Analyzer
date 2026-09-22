const mongoose = require('mongoose');
const { rawJDText } = require('../validations/analysis.validations');

const schema = new mongoose.Schema({
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, immutable: true },
    rawJDText: { type: String, required: true, immutable: true,
        validate: { validator: value => rawJDText.safeParse(value).success, message: 'Invalid job description length.' } },
    sourceType: { type: String, enum: ['text', 'pdf'], default: 'text', required: true, immutable: true },
    originalFile: { type: new mongoose.Schema({ key: String, name: String, size: Number }, { _id: false }), immutable: true },
    extractionStatus: { type: String, enum: ['completed'], immutable: true },
    structuredJD: { type: mongoose.Schema.Types.Mixed, validate: {
        validator: value => require('../validations/jd-requirements.validations').structuredJD.safeParse(value).success,
        message: 'Invalid structured JD requirements.',
    } },
    parserVersion: String,
    modelName: String,
    extractedAt: Date,
    requirementsReviewedAt: Date,
    processingJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcessingJob' },
    status: { type: String, enum: ['draft'], default: 'draft', required: true },
}, { timestamps: true });

// Replacing a whole document bypasses normal immutable-path handling.
schema.pre(['replaceOne', 'findOneAndReplace'], function () {
    throw new Error('Analysis replacement is not allowed; preserve the original JD.');
});

module.exports = mongoose.model('Analysis', schema);
