const { z } = require('zod');
const text = z.string().min(1).max(500).refine(value => value.trim().length > 0);
const items = z.array(text).max(50);
const years = z.number().min(0).max(100).nullable();
const structuredJD = z.object({
    title: text.nullable(), requiredSkills: items, preferredSkills: items,
    minimumExperience: years, maximumExperience: years,
    education: items, certifications: items, responsibilities: items,
    domain: text.nullable(), location: text.nullable(), employmentType: text.nullable(),
}).strict().refine(value => value.minimumExperience === null || value.maximumExperience === null ||
    value.minimumExperience <= value.maximumExperience, 'Invalid experience range.');
const extractionResult = z.object({ structuredJD, parserVersion: z.literal('jd-v1'),
    modelName: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/), extractedAt: z.iso.datetime() }).strict();
module.exports = { structuredJD, extractionResult };
