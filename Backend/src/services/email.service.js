const nodemailer = require("nodemailer");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const emailPassword = (process.env.EMAIL_PASS || "").replace(/\s/g, "");

const smtpTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,
    auth: {
        user: process.env.EMAIL_USER,
        pass: emailPassword,
    },
    tls: {
        servername: "smtp.gmail.com",
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
});

async function sendWithBrevo({ to, subject, html, replyTo }) {
    const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.EMAIL_USER;
    const fromName = process.env.BREVO_FROM_NAME || "PrepWise AI";

    if (!fromEmail) {
        throw new Error("BREVO_FROM_EMAIL or EMAIL_USER must be configured.");
    }

    const payload = {
        sender: {
            name: fromName,
            email: fromEmail,
        },
        to: (Array.isArray(to) ? to : [to]).map((email) => ({ email })),
        subject,
        htmlContent: html,
    };

    if (replyTo) {
        payload.replyTo = { email: replyTo };
    }

    const response = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "api-key": process.env.BREVO_API_KEY,
            accept: "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || `Brevo API failed with status ${response.status}`);
    }

    return data;
}

async function sendWithSmtp({ to, subject, html, replyTo, fromName = "PrepWise AI" }) {
    if (!process.env.EMAIL_USER || !emailPassword) {
        throw new Error("EMAIL_USER and EMAIL_PASS must be configured for SMTP email.");
    }

    await smtpTransporter.sendMail({
        from: `"${fromName}" <${process.env.EMAIL_USER}>`,
        to,
        replyTo,
        subject,
        html,
    });
}

async function sendEmail(options) {
    if (process.env.BREVO_API_KEY) {
        return sendWithBrevo(options);
    }

    return sendWithSmtp(options);
}

async function sendOtpEmail(to, otp) {
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fafafa; border-radius: 16px;">
            <h2 style="color: #1e293b; margin-bottom: 8px;">Email Verification</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                Use the code below to verify your email address. This code expires in <strong>5 minutes</strong>.
            </p>
            <div style="background: linear-gradient(135deg, #d946ef, #f97316); color: white; font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 12px; margin: 24px 0;">
                ${otp}
            </div>
            <p style="color: #94a3b8; font-size: 12px;">
                If you didn't request this, you can safely ignore this email.
            </p>
        </div>
    `;

    await sendEmail({
        to,
        subject: "Verify Your Email - PrepWise AI",
        html,
    });
}

async function sendResetPasswordEmail(to, resetUrl) {
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fafafa; border-radius: 16px;">
            <h2 style="color: #1e293b; margin-bottom: 8px;">Password Reset</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #d946ef, #f97316); color: white; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px;">
                    Reset Password
                </a>
            </div>
            <p style="color: #94a3b8; font-size: 12px;">
                If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
            </p>
        </div>
    `;

    await sendEmail({
        to,
        subject: "Reset Your Password - PrepWise AI",
        html,
    });
}

async function sendGoogleAuthReminderEmail(to) {
    const loginUrl = `${process.env.FRONTEND_URL || "https://ai-resume-analyzer-gray-ten.vercel.app"}/login`;
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fafafa; border-radius: 16px;">
            <h2 style="color: #1e293b; margin-bottom: 8px;">Google Sign-In Reminder</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                We received a password reset request for your account. However, you registered using <strong>Google OAuth</strong> and do not have a local password stored on our platform.
            </p>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                To access your PrepWise AI workspace, please log in using the Google button on the sign-in page.
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #d946ef, #f97316); color: white; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px;">
                    Go to Login Page
                </a>
            </div>
            <p style="color: #94a3b8; font-size: 12px;">
                If you didn't request this, you can safely ignore this email.
            </p>
        </div>
    `;

    await sendEmail({
        to,
        subject: "Google Login Reminder - PrepWise AI",
        html,
    });
}

async function sendContactEmail(senderName, senderEmail, message) {
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #fafafa; border-radius: 16px; border: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Contact Form Submission</h2>
            <div style="margin-bottom: 12px;">
                <strong>Name:</strong> <span style="color: #334155;">${senderName}</span>
            </div>
            <div style="margin-bottom: 12px;">
                <strong>Email:</strong> <span style="color: #334155;"><a href="mailto:${senderEmail}">${senderEmail}</a></span>
            </div>
            <div style="margin-top: 20px; padding: 16px; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; color: #334155; line-height: 1.6; white-space: pre-wrap;">
                ${message}
            </div>
        </div>
    `;

    await sendEmail({
        to: process.env.EMAIL_USER || process.env.BREVO_FROM_EMAIL,
        replyTo: senderEmail,
        subject: `New Contact Message from ${senderName}`,
        html,
        fromName: "PrepWise Contact Form",
    });
}

module.exports = { sendOtpEmail, sendResetPasswordEmail, sendGoogleAuthReminderEmail, sendContactEmail };
