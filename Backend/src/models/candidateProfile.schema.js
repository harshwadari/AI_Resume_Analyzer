const mongoose = require('mongoose');
const options = { _id: false, strict: 'throw' };
const text = { type: String, default: null, maxlength: 2000 };
const evidence = new mongoose.Schema({ pageNumber: { type: Number, min: 1, max: 50, required: true }, text: { type: String, required: true, maxlength: 20000 } }, options);
const experience = new mongoose.Schema({ company: text, title: text, startDate: text, endDate: text,
    description: text, skills: [String], evidence: [evidence] }, options);
const education = new mongoose.Schema({ institution: text, qualification: text, startDate: text, endDate: text, evidence: [evidence] }, options);
const project = new mongoose.Schema({ name: text, description: text, skills: [String], evidence: [evidence] }, options);
const profile = new mongoose.Schema({ candidateName: text, email: text, phone: text, location: text,
    skills: [String], jobTitles: [String], totalExperience: text, experiences: [experience], education: [education],
    projects: [project], certifications: [String], domains: [String], languages: [String], rawText: String }, options);
const chunk = new mongoose.Schema({ analysisId: String, resumeId: String, candidateId: String,
    section: { type: String, enum: ['summary', 'skills', 'experience', 'job_experience', 'projects', 'education', 'certifications', 'languages', 'other'] },
    pageStart: Number, pageEnd: Number, chunkIndex: Number, text: String, sourceStart: Number, sourceEnd: Number }, options);
module.exports = { profile, chunk };
