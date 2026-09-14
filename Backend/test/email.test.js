const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { load } = require('./helpers');

test('existing email templates compile through Nodemailer without a network connection', async () => {
    const messages = [];
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const mail = load('src/services/email.service.js', {
        nodemailer: { createTransport: options => {
            assert.equal(options.service, 'gmail');
            assert.equal(options.socketTimeout, 30_000);
            return { sendMail: async options => {
                const compiled = await transport.sendMail(options);
                messages.push({ options, compiled });
                return compiled;
            } };
        } },
        '../config/auth.config': { authConfig: () => ({ frontend: 'https://frontend.example' }) },
    }, { EMAIL_USER: 'sender@example.com', EMAIL_PASS: 'synthetic' });
    await mail.sendOtpEmail('recipient@example.com', '123456');
    await mail.sendResetPasswordEmail('recipient@example.com', 'https://frontend.example/reset-password/' + 'a'.repeat(64));
    await mail.sendGoogleAuthReminderEmail('recipient@example.com');
    assert.equal(messages.length, 3);
    for (const { options, compiled } of messages) {
        assert.deepEqual(compiled.envelope.to, ['recipient@example.com']);
        assert.ok(compiled.message.length > 0);
        assert.equal(options.raw, undefined);
    }
    assert.match(messages[0].options.html, /123456/);
    assert.match(messages[1].options.html, /reset-password\/a{64}/);
    assert.match(messages[2].options.html, /Google OAuth/);
});
