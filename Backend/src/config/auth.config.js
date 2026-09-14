function origin(value, fallback) {
    const url = new URL(value || fallback);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
        throw new Error('Authentication URLs must be HTTP(S) origins without credentials, paths or queries');
    }
    return url.origin;
}
function authConfig() {
    const production = process.env.NODE_ENV === 'production';
    const frontend = origin(process.env.FRONTEND_URL, production ? undefined : 'http://localhost:5173');
    const backend = origin(process.env.BACKEND_URL, production ? undefined : 'http://localhost:3001');
    if (production && (!frontend.startsWith('https:') || !backend.startsWith('https:'))) throw new Error('Production authentication requires HTTPS');
    const sameSite = process.env.COOKIE_SAME_SITE || (production ? 'none' : 'lax');
    if (!['none', 'lax', 'strict'].includes(sameSite) || (sameSite === 'none' && !production)) throw new Error('Invalid authentication cookie configuration');
    return { frontend, backend, production, sameSite };
}
function cookieOptions() {
    const { production, sameSite } = authConfig();
    return { httpOnly: true, secure: production, sameSite, path: '/', maxAge: 24 * 60 * 60 * 1000 };
}
function clearAuthCookie(res) {
    const { maxAge, ...options } = cookieOptions();
    res.clearCookie('token', options);
}
function validateAuthConfig() {
    authConfig();
    if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes of random secret material');
    if (Boolean(process.env.GOOGLE_CLIENT_ID) !== Boolean(process.env.GOOGLE_CLIENT_SECRET)) throw new Error('Both Google OAuth credentials must be configured together');
    const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
    if (!Number.isInteger(hops) || hops < 0 || hops > 5) throw new Error('TRUST_PROXY_HOPS must be an integer from 0 through 5');
}
module.exports = { authConfig, cookieOptions, clearAuthCookie, validateAuthConfig };
