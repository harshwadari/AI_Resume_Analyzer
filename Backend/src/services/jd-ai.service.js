const AppError = require('../utils/AppError');
const { extractionResult } = require('../validations/jd-requirements.validations');
const client = require('./ai-client.service');

async function extract(rawJDText) {
    const result = await client.request('/v1/jd/extract', { body: { rawJDText }, timeout: 55000 });
    const parsed = extractionResult.safeParse(result);
    if (!parsed.success) throw new AppError('JD extraction returned invalid requirements. Please retry.', 502);
    return parsed.data;
}
module.exports = { extract };
