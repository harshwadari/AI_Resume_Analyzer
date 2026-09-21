const { z } = require('zod');

// Validate without transforming: whitespace and line breaks belong to the original.
const rawJDText = z.string()
    .max(20000, 'Job description must be at most 20,000 characters.')
    .refine(text => text.trim().length >= 100, 'Add at least 100 characters of job description content.');

const createAnalysisSchema = z.object({ rawJDText }).strict();
module.exports = { createAnalysisSchema, rawJDText };
