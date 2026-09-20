const mongoose = require('mongoose');
const User = require('../models/user.model');
const Report = require('../models/interviewReport.model');
const OAuthState = require('../models/oauthState.model');
const AppError = require('../utils/AppError');

async function deleteAccount(userId) {
    // Commit all personal-data removal together; failures leave the account intact.
    await mongoose.connection.transaction(async session => {
        const user = await User.findOneAndDelete({ _id: userId }, { session });
        if (!user) throw new AppError('This account no longer exists. Please sign in again.', 401);
        await Report.deleteMany({ user: userId }, { session });
        await OAuthState.deleteMany({ linkUserId: userId }, { session });
    });
}

async function saveReportForUser(userId, data) {
    return mongoose.connection.transaction(async session => {
        // Serialize report completion with deletion, including slow AI requests
        // that started before deletion. A deleted account cannot leave new data.
        const user = await User.findOneAndUpdate({ _id: userId }, { $inc: { __v: 1 } }, { session });
        if (!user) throw new AppError('This account no longer exists. Please sign in again.', 401);
        const [report] = await Report.create([{ ...data, user: userId }], { session });
        return report;
    });
}

module.exports = { deleteAccount, saveReportForUser };
