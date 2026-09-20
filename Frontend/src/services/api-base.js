// Production uses Vercel's /api rewrite so cookies stay first-party.
export function resolveApiOrigin(value, production) {
  const configured = value?.trim();
  if (configured === '/') return '';
  if (!configured) return production ? '' : 'http://localhost:3001';
  let url;
  try { url = new URL(configured); } catch { throw new Error('VITE_API_URL must be an HTTP(S) origin or /'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (production && url.protocol !== 'https:')) {
    throw new Error('VITE_API_URL must be an origin without a path; production requires HTTPS');
  }
  return url.origin;
}
