const dns = require('dns');
dns.setServers(['8.8.8.8','8.8.4.4']);
const path = require('path');
const backendDir = 'c:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/Backend';

const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const nodemailer = require(path.join(backendDir, 'node_modules/nodemailer'));

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

console.log('Sending test email using SMTP credentials...');
transporter.sendMail({
  from: `"PrepWise AI" <${process.env.EMAIL_USER}>`,
  to: 'harshwadari@gmail.com',
  subject: 'PrepWise AI — SMTP Connection Test',
  text: 'If you receive this, the Nodemailer SMTP connection is configured and working perfectly.'
}).then((info) => {
  console.log('SUCCESS: Email sent!', info.messageId);
  process.exit(0);
}).catch((err) => {
  console.error('FAILED: Nodemailer error:', err);
  process.exit(1);
});
