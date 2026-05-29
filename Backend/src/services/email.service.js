const nodemailer = require("nodemailer");

/**
 * Email Service — Handles all outgoing emails using Nodemailer.
 *
 * Uses Gmail SMTP by default.
 * Required env vars:
 *   EMAIL_USER — Your Gmail address (e.g. project.noreplies@gmail.com)
 *   EMAIL_PASS — Gmail App Password (16-character code)
 */

// Create reusable transporter (created once, reused for all emails)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 10000, // 10 seconds connection timeout
    greetingTimeout: 10000,   // 10 seconds greeting timeout
    socketTimeout: 10000,     // 10 seconds socket timeout
});

/**
 * sendOtpEmail — Sends a styled HTML email containing the 6-digit OTP.
 *
 * @param {string} to    - Recipient email address
 * @param {string} otp   - The 6-digit OTP code
 */
async function sendOtpEmail(to, otp) {
    const mailOptions = {
        from: `"PrepWise AI" <${process.env.EMAIL_USER}>`,
        to,
        subject: "Verify Your Email — PrepWise AI",
        html: `
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
        `,
    };

    await transporter.sendMail(mailOptions);
}

/**
 * sendResetPasswordEmail — Sends a password reset link to the user.
 *
 * @param {string} to       - Recipient email address
 * @param {string} resetUrl - Full reset URL with token
 */
async function sendResetPasswordEmail(to, resetUrl) {
    const mailOptions = {
        from: `"PrepWise AI" <${process.env.EMAIL_USER}>`,
        to,
        subject: "Reset Your Password — PrepWise AI",
        html: `
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
        `,
    };

    await transporter.sendMail(mailOptions);
}

/**
 * sendGoogleAuthReminderEmail — Sends a reminder email to Google OAuth users
 * explaining they don't have a local password and should log in using Google.
 *
 * @param {string} to - Recipient email address
 */
async function sendGoogleAuthReminderEmail(to) {
    const loginUrl = `${process.env.FRONTEND_URL || "https://ai-resume-analyzer-gray-ten.vercel.app"}/login`;
    const mailOptions = {
        from: `"PrepWise AI" <${process.env.EMAIL_USER}>`,
        to,
        subject: "Google Login Reminder — PrepWise AI",
        html: `
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
        `,
    };

    await transporter.sendMail(mailOptions);
}

/**
 * sendContactEmail — Sends contact form details to the site owner.
 *
 * @param {string} senderName    - Name of the person submitting the form
 * @param {string} senderEmail   - Email of the person submitting the form
 * @param {string} message       - Message text
 */
async function sendContactEmail(senderName, senderEmail, message) {
    const mailOptions = {
        from: `"PrepWise Contact Form" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        replyTo: senderEmail,
        subject: `New Contact Message from ${senderName}`,
        html: `
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
        `,
    };

    await transporter.sendMail(mailOptions);
}

module.exports = { sendOtpEmail, sendResetPasswordEmail, sendGoogleAuthReminderEmail, sendContactEmail };
