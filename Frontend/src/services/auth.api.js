import axios from "axios";

const API_BASE = "http://localhost:3000/api/auth";

export async function register({ username, email, password }) {
    try {
        const response = await axios.post(
            `${API_BASE}/register`,
            { username, email, password },
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        console.error("Register API error:", err);
        throw err;
    }
}

export async function login({ email, password }) {
    try {
        const response = await axios.post(
            `${API_BASE}/login`,
            { email, password },
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        console.error("Login API error:", err);
        throw err;
    }
}

export async function logout() {
    try {
        const response = await axios.get(
            `${API_BASE}/logout`,
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        console.error("Logout API error:", err);
        throw err;
    }
}

export async function getMe() {
    try {
        const response = await axios.get(
            `${API_BASE}/get-me`,
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        console.error("GetMe API error:", err);
        throw err;
    }
}

// ── New: OTP Verification ──

export async function verifyOtp({ email, otp }) {
    try {
        const response = await axios.post(
            `${API_BASE}/verify-otp`,
            { email, otp },
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        console.error("VerifyOtp API error:", err);
        throw err;
    }
}

export async function resendOtp({ email }) {
    try {
        const response = await axios.post(
            `${API_BASE}/resend-otp`,
            { email },
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        console.error("ResendOtp API error:", err);
        throw err;
    }
}

// ── New: Forgot / Reset Password ──

export async function forgotPassword({ email }) {
    try {
        const response = await axios.post(
            `${API_BASE}/forgot-password`,
            { email },
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        console.error("ForgotPassword API error:", err);
        throw err;
    }
}

export async function resetPassword({ token, password }) {
    try {
        const response = await axios.post(
            `${API_BASE}/reset-password`,
            { token, password },
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        console.error("ResetPassword API error:", err);
        throw err;
    }
}

export function getGoogleAuthUrl() {
    return `${API_BASE}/google`;
}

export async function contact({ name, email, message }) {
    try {
        const response = await axios.post(
            `${API_BASE}/contact`,
            { name, email, message },
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        console.error("Contact API error:", err);
        throw err;
    }
}