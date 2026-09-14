const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    _id: String,
    browserHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    linkUserId: { type: mongoose.Schema.Types.ObjectId, default: null },
    linkVersion: { type: Number, default: 0 },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('OAuthState', schema);
