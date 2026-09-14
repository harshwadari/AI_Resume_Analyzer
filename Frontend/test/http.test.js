import { expect, test } from 'vitest';
import { createApiClient } from '../src/services/http';
import { advanceSession } from '../src/services/session';

test('API uses credentials and CSRF header without a readable bearer token', async () => {
  const api = createApiClient({ adapter: async config => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }) });
  const response = await api.post('/api/auth/login', { email: 'test@example.com', password: 'synthetic' });
  expect(response.config.withCredentials).toBe(true);
  expect(response.config.headers['X-Requested-With']).toBe('XMLHttpRequest');
  expect(response.config.headers.Authorization).toBeUndefined();
});

test('late API results from a previous session are discarded', async () => {
  let finish;
  const api = createApiClient({ adapter: config => new Promise(resolve => { finish = () => resolve({ data: {}, status: 200, config }); }) });
  const pending = api.get('/api/interview');
  await Promise.resolve(); await Promise.resolve();
  advanceSession(); finish();
  await expect(pending).rejects.toMatchObject({ code: 'ERR_CANCELED' });
});
