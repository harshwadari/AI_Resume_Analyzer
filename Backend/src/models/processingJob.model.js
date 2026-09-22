const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    analysis: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    resumeIds: { type: [mongoose.Schema.Types.ObjectId], required: true, immutable: true },
    status: { type: String, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS'], default: 'PENDING' },
    dispatchError: String,
}, { timestamps: true });
module.exports = mongoose.model('ProcessingJob', schema);
