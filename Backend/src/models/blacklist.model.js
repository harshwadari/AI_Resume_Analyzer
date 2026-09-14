const mongoose = require("mongoose")

const blackListTokenSchema = new mongoose.Schema({
    token : {
        type : String,
        required : [true, "token is required to be added"]

    },
    // Legacy collection only. New sessions are revoked by User.tokenVersion.
    expiresAt: { type: Date, default: Date.now }

},{
    timestamps : true
})

blackListTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const tokenBlackListModel = mongoose.model("blackListTokens", blackListTokenSchema)

module.exports = tokenBlackListModel

