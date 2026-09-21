import { createApiClient } from '../../../services/http';

const api = createApiClient();
export const createAnalysis = async (rawJDText, options = {}) =>
  (await api.post('/api/recruiter/analyses', { rawJDText }, options)).data.analysis;
export const getAnalysis = async (analysisId, options = {}) =>
  (await api.get(`/api/recruiter/analyses/${encodeURIComponent(analysisId)}`, options)).data.analysis;
