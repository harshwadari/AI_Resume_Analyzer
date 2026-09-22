const AppError = require('../utils/AppError');

async function request(path, { body, timeout = 5000 } = {}) {
    const endpoint = process.env.AI_SERVICE_URL;
    const token = process.env.AI_SERVICE_TOKEN;
    if (!endpoint || !token || token.length < 32) throw new AppError('AI service is not configured.', 503);
    let url;
    try {
        url = new URL(endpoint);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    } catch { throw new AppError('AI service is not configured.', 503); }
    try {
        const response = await fetch(new URL(path, url), {
            method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(timeout),
            headers: { 'Content-Type': 'application/json', 'X-AI-Service-Token': token },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!response.ok) throw new AppError('AI service is unavailable. Please retry.', response.status === 504 ? 504 : 502);
        return await response.json();
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('AI service could not be reached. Please retry.', error.name === 'TimeoutError' ? 504 : 502);
    }
}

async function health() {
    const result = await request('/health');
    if (result?.status !== 'ok' || result?.service !== 'prepwise-ai') throw new AppError('Invalid AI health response.', 502);
    return { status: result.status, service: result.service };
}
module.exports = { request, health };
