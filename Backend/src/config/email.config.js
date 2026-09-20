function emailConfigured(env = process.env) {
    if (env.EMAIL_PROVIDER === 'brevo') return Boolean(env.BREVO_API_KEY && env.BREVO_FROM_EMAIL);
    return (!env.EMAIL_PROVIDER || env.EMAIL_PROVIDER === 'smtp') && Boolean(env.EMAIL_USER && env.EMAIL_PASS);
}
module.exports = { emailConfigured };
