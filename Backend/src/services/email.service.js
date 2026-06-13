const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Using Resend's free default sender — works without any domain verification.
// Recipients can be any email address (Gmail, Yahoo, etc.)
const FROM_ADDRESS = "onboarding@resend.dev";

/**
 * Core send helper — wraps the Resend SDK and throws a clean error on failure.
 */
async function sendEmail({ to, subject, html, replyTo }) {
    const payload = {
        from: FROM_ADDRESS,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
    };

    if (replyTo) {
        payload.reply_to = replyTo;
    }

    console.log(`[Email] Sending "${subject}" to ${payload.to.join(", ")} from ${FROM_ADDRESS}`);

    const { data, error } = await resend.emails.send(payload);

    if (error) {
        console.error("[Email] Resend API error:", JSON.stringify(error));
        throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
    }

    console.log(`[Email] Sent successfully. ID: ${data?.id}`);
    return data;
}

// ── OTP Verification Email ──────────────────────────────────────────────────
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

// ── Password Reset Email ────────────────────────────────────────────────────
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

// ── Google Auth Reminder Email ──────────────────────────────────────────────
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

// ── Contact Form Email ──────────────────────────────────────────────────────
async function sendContactEmail(senderName, senderEmail, message) {
    const ownerEmail = process.env.RESEND_FROM_EMAIL || process.env.CONTACT_RECIPIENT_EMAIL;

    if (!ownerEmail) {
        throw new Error("RESEND_FROM_EMAIL or CONTACT_RECIPIENT_EMAIL must be set to receive contact form emails.");
    }

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
        to: ownerEmail,
        replyTo: senderEmail,
        subject: `New Contact Message from ${senderName}`,
        html,
    });
}

module.exports = { sendOtpEmail, sendResetPasswordEmail, sendGoogleAuthReminderEmail, sendContactEmail };
