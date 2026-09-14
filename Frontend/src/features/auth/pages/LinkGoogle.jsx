import { useState } from 'react';
import { Link } from 'react-router-dom';
import { reauthenticate, getGoogleAuthUrl } from '../../../services/auth.api';

export default function LinkGoogle() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await reauthenticate(password);
      setPassword('');
      window.location.assign(getGoogleAuthUrl(true));
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to link Google. Please try again.');
      setLoading(false);
    }
  }
  return <main className="page-shell flex min-h-screen items-center justify-center p-6">
    <form onSubmit={submit} className="glass-panel w-full max-w-md space-y-5 rounded-3xl p-8">
      <h1 className="text-2xl font-semibold">Link your Google account</h1>
      <p>Confirm your current password, then choose Google with the same email address. Your password login will remain available.</p>
      <input aria-label="Current password" type="password" autoComplete="current-password" required value={password}
        onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border p-3 text-slate-900" />
      {error && <p role="alert" className="text-rose-600">{error}</p>}
      <button disabled={loading} className="rounded-xl bg-violet-600 px-5 py-3 text-white">{loading ? 'Checking…' : 'Continue with Google'}</button>
      <Link to="/workspace" className="block">Back to workspace</Link>
    </form>
  </main>;
}
