const crypto = require("crypto");

/**
 * generateOtp — Creates a cryptographically secure 6-digit OTP.
 *
 * Uses crypto.randomInt() instead of Math.random() because
 * Math.random() is NOT cryptographically secure and can be predicted.
 *
 * @returns {string} A 6-digit OTP string (e.g. "048291")
 */
function generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
}

/**
 * generateResetToken — Creates a secure hex token for password resets.
 *
 * 32 random bytes → 64 hex characters.
 * This token is sent to the user's email as part of the reset URL.
 * We store a hashed version in the DB so a DB leak won't compromise reset links.
 *
 * @returns {string} A 64-character hex string
 */
function generateResetToken() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * hashToken — Hashes a reset token using SHA-256 for secure DB storage.
 *
 * We hash the token before storing it because if the DB is compromised,
 * attackers shouldn't be able to use raw tokens to reset passwords.
 *
 * @param {string} token - The raw reset token
 * @returns {string} SHA-256 hash of the token
 */
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = { generateOtp, generateResetToken, hashToken };
