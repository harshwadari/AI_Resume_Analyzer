require('dotenv').config({ quiet: true });
require('../src/services/ai-client.service').health()
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
