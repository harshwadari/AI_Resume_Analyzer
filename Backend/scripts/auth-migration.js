require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const LegacyBlacklist = require('../src/models/blacklist.model');
const { ensureAuthIndexes } = require('../src/config/auth-indexes');

async function main() {
    require('../src/config/database').configureMongoDns();
    // Default is read-only. --apply performs the documented additive migration.
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
    let conflicts = 0;
    for (const field of ['email', 'username', 'googleId']) {
        const result = await User.aggregate([
            { $match: { [field]: { $type: 'string' } } },
            { $group: { _id: '$' + field, count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }, { $count: 'groups' },
        ]);
        const count = result[0]?.groups || 0;
        console.log(`${field}: ${count} duplicate groups`);
        conflicts += count;
    }
    if (conflicts) throw new Error('Resolve duplicate account identities before applying indexes');
    if (!process.argv.includes('--apply')) {
        console.log('Read-only preflight finished; no data changed.');
        return;
    }
    await ensureAuthIndexes();
    await User.updateMany({ tokenVersion: { $exists: false } }, { $set: { tokenVersion: 0 } });
    // Legacy plaintext codes cannot be used by the new verifier. Invalidate them;
    // pending users can request a fresh registration OTP.
    await User.updateMany({ otp: { $type: 'string' } }, { $set: { otp: null, otpExpiry: null } });
    await LegacyBlacklist.updateMany({ expiresAt: { $exists: false } }, { $set: { expiresAt: new Date() } });
    await LegacyBlacklist.createIndexes();
    console.log('Indexes and compatibility fields applied. Legacy blacklist records are scheduled for TTL removal.');
}
main().catch(() => { console.error('Authentication migration failed; inspect configuration and duplicate identities. No accounts are merged or deleted by this script.'); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
