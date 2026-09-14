import axios from 'axios';
import { sessionEpoch } from './session';

export function createApiClient(options = {}) {
  const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, ''),
    timeout: 120000,
    withCredentials: true,
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    ...options,
  });
  api.interceptors.request.use(config => {
    config.sessionEpoch = sessionEpoch();
    return config;
  });
  api.interceptors.response.use(response => {
    if (response.config.sessionEpoch !== sessionEpoch()) throw new axios.CanceledError('Session changed');
    return response;
  }, error => {
    if (error.config?.sessionEpoch !== sessionEpoch()) throw new axios.CanceledError('Session changed');
    if (error.response?.status === 401 && !error.config?.skipAuthNotification) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  });
  return api;
}
