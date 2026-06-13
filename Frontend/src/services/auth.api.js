import axios from "axios";

const VITE_API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
const API_BASE = `${VITE_API_URL}/api/auth`;

// Create axios instance with timeout to prevent infinite hangs.
// 120s accounts for Render free tier cold start (up to 60s) + email sending time.
const api = axios.create({
    timeout: 120000, // 120 seconds
    withCredentials: true,
});

// Interceptor to attach Authorization header if token exists in localStorage
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export async function register({ username, email, password }) {
    try {
        const response = await api.post(
            `${API_BASE}/register`,
            { username, email, password }
        );
        return response.data;
    } catch (err) {
        console.error("Register API error:", err);
        throw err;
    }
}

export async function login({ email, password }) {
    try {
        const response = await api.post(
            `${API_BASE}/login`,
            { email, password }
        );
        if (response.data?.token) {
            localStorage.setItem("token", response.data.token);
        }
        return response.data;
    } catch (err) {
        console.error("Login API error:", err);
        throw err;
    }
}

export async function logout() {
    try {
        const response = await api.get(
            `${API_BASE}/logout`
        );
        localStorage.removeItem("token");
        return response.data;
    } catch (err) {
        console.error("Logout API error:", err);
        localStorage.removeItem("token");
        throw err;
    }
}

export async function getMe() {
    try {
        const response = await api.get(
            `${API_BASE}/get-me`
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
        const response = await api.post(
            `${API_BASE}/verify-otp`,
            { email, otp }
        );
        if (response.data?.token) {
            localStorage.setItem("token", response.data.token);
        }
        return response.data;
    } catch (err) {
        console.error("VerifyOtp API error:", err);
        throw err;
    }
}

export async function resendOtp({ email }) {
    try {
        const response = await api.post(
            `${API_BASE}/resend-otp`,
            { email }
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
        // Extra timeout for forgot-password: Render cold start + Gmail SMTP can be slow
        const response = await api.post(
            `${API_BASE}/forgot-password`,
            { email },
            { timeout: 120000 }
        );
        return response.data;
    } catch (err) {
        console.error("ForgotPassword API error:", err);
        throw err;
    }
}

export async function resetPassword({ token, password }) {
    try {
        const response = await api.post(
            `${API_BASE}/reset-password`,
            { token, password }
        );
        return response.data;
    } catch (err) {
        console.error("ResetPassword API error:", err);
        throw err;
    }
}

export async function setToken(token) {
    try {
        const response = await api.post(
            `${API_BASE}/set-token`,
            { token }
        );
        localStorage.setItem("token", token);
        return response.data;
    } catch (err) {
        console.error("SetToken API error:", err);
        localStorage.setItem("token", token);
        return { success: true }; // return success as we saved it locally anyway
    }
}

export function getGoogleAuthUrl() {
    return `${API_BASE}/google`;
}

export async function contact({ name, email, message }) {
    try {
        const response = await api.post(
            `${API_BASE}/contact`,
            { name, email, message }
        );
        return response.data;
    } catch (err) {
        console.error("Contact API error:", err);
        throw err;
    }
}