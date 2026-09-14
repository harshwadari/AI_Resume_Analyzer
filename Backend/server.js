const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { validateAuthConfig } = require('./src/config/auth.config');
const { ensureAuthIndexes } = require('./src/config/auth-indexes');
const connectDB = require('./src/config/database');

async function start() {
    validateAuthConfig();
    await connectDB();
    await ensureAuthIndexes();
    const app = require('./src/app');
    const port = process.env.PORT || 3001;
    return app.listen(port, () => console.log('Server is ready'));
}
if (require.main === module) {
    start().catch(async err => {
        require('./src/utils/securityLog').logFailure('Authentication startup failed; check configuration and identity indexes', err);
        await require('mongoose').disconnect();
        process.exitCode = 1;
    });
}
module.exports = { start };
