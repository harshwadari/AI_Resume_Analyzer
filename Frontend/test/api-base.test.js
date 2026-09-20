import { expect, test } from 'vitest';
import { resolveApiOrigin } from '../src/services/api-base';

test('production defaults to first-party API and development keeps local backend', () => {
  expect(resolveApiOrigin(undefined, true)).toBe('');
  expect(resolveApiOrigin('/', true)).toBe('');
  expect(resolveApiOrigin(undefined, false)).toBe('http://localhost:3001');
  expect(resolveApiOrigin('https://api.example.com/', true)).toBe('https://api.example.com');
  for (const value of ['http://localhost:3001', 'https://api.example.com/api', 'https://user:password@api.example.com', 'invalid']) {
    expect(() => resolveApiOrigin(value, true)).toThrow(/VITE_API_URL/);
  }
});
