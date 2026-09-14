const mongoose = require('mongoose');
const dns = require('node:dns');
function configureMongoDns() {
    const servers = process.env.MONGO_DNS_SERVERS?.split(',').map(value => value.trim()).filter(Boolean);
    if (servers?.length) dns.setServers(servers);
}
async function connectDB() {
    if (!process.env.MONGO_URI) throw new Error('Database configuration is missing');
    configureMongoDns();
    return mongoose.connect(process.env.MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
}
module.exports = connectDB;
module.exports.configureMongoDns = configureMongoDns;
