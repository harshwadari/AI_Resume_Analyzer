import { createApiClient } from '../../../services/http';

const api = createApiClient();
export const createAnalysis = async (rawJDText, options = {}) =>
  (await api.post('/api/recruiter/analyses', { rawJDText }, options)).data.analysis;
export const getAnalysis = async (analysisId, options = {}) =>
  (await api.get(`/api/recruiter/analyses/${encodeURIComponent(analysisId)}`, options)).data.analysis;
export const createPdfAnalysis = async (file, options = {}) => {
  const form = new FormData();
  form.append('jd', file);
  return (await api.post('/api/recruiter/analyses/pdf', form, options)).data.analysis;
};
export const downloadOriginal = async analysisId =>
  (await api.get(`/api/recruiter/analyses/${encodeURIComponent(analysisId)}/original`, { responseType: 'blob' })).data;
export const extractRequirements = async (analysisId, options = {}) =>
  (await api.post(`/api/recruiter/analyses/${encodeURIComponent(analysisId)}/requirements/extract`, {}, options)).data.analysis;
export const reviewRequirements = async (analysisId, options = {}) =>
  (await api.post(`/api/recruiter/analyses/${encodeURIComponent(analysisId)}/requirements/review`, {}, options)).data.analysis;
export const uploadResumes = async (analysisId, files, options = {}) => {
  const form = new FormData();
  files.forEach(file => form.append('resumes', file));
  return (await api.post(`/api/recruiter/analyses/${encodeURIComponent(analysisId)}/resumes`, form, options)).data.resumes;
};
export const listResumes = async (analysisId, page = 1, options = {}) =>
  (await api.get(`/api/recruiter/analyses/${encodeURIComponent(analysisId)}/resumes`, { ...options, params: { page } })).data;
export const uploadResumeZip = async (analysisId, file, options = {}) => {
  const form = new FormData(); form.append('archive', file);
  return (await api.post(`/api/recruiter/analyses/${encodeURIComponent(analysisId)}/resumes/zip`, form, options)).data;
};
