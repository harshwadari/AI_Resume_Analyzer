const safeCodes = new Set(['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ECONNREFUSED']);
function logFailure(event, error) {
    // Never serialize errors: SMTP, MongoDB and HTTP errors can contain secrets.
    const code = typeof error?.code === 'number' || safeCodes.has(error?.code) ? error.code : 'UNAVAILABLE';
    console.error(event, { code });
}
module.exports = { logFailure };
