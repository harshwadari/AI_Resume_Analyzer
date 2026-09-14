const User = require('../models/user.model');
const State = require('../models/oauthState.model');
const Rate = require('../models/authRate.model');

async function ensureAuthIndexes() {
    // Never drop indexes or merge/delete accounts. Duplicate identities fail
    // startup, requiring a reviewed resolution of the existing account data.
    await User.createIndexes();
    await State.createIndexes();
    await Rate.createIndexes();
}
module.exports = { ensureAuthIndexes };
