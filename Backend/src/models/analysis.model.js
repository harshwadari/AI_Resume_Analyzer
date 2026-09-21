const mongoose = require('mongoose');
const { rawJDText } = require('../validations/analysis.validations');

const schema = new mongoose.Schema({
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, immutable: true },
    rawJDText: { type: String, required: true, immutable: true,
        validate: { validator: value => rawJDText.safeParse(value).success, message: 'Invalid job description length.' } },
    sourceType: { type: String, enum: ['text'], default: 'text', required: true, immutable: true },
    status: { type: String, enum: ['draft'], default: 'draft', required: true },
}, { timestamps: true });

// Replacing a whole document bypasses normal immutable-path handling.
schema.pre(['replaceOne', 'findOneAndReplace'], function () {
    throw new Error('Analysis replacement is not allowed; preserve the original JD.');
});

module.exports = mongoose.model('Analysis', schema);
