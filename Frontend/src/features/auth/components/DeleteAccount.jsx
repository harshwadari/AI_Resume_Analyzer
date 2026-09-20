import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function DeleteAccount() {
  const { handleDeleteAccount, loading } = useAuth();
  const navigate = useNavigate();
  const dialog = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  function close() {
    setOpen(false);
    setConfirmation('');
    setError('');
    trigger.current?.focus();
  }
  async function submit(event) {
    event.preventDefault();
    if (loading || confirmation !== 'DELETE') return;
    setError('');
    const result = await handleDeleteAccount(confirmation);
    if (result.success) navigate('/', { replace: true });
    else setError(result.message);
  }

  return <>
    <button ref={trigger} type="button" disabled={loading} onClick={() => setOpen(true)}
      className="rounded-xl border border-rose-300/60 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10">
      Delete account
    </button>
    <dialog ref={dialog} aria-labelledby="delete-account-title" onCancel={event => { event.preventDefault(); if (!loading) close(); }}
      className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-black/60 dark:border-white/10 dark:bg-slate-900 dark:text-white">
      <form onSubmit={submit} className="space-y-4">
        <h2 id="delete-account-title" className="text-xl font-semibold">Permanently delete your account?</h2>
        <p className="text-sm leading-6">Your profile, saved interview reports, resume text, and preparation data will be permanently deleted. This cannot be undone.</p>
        <p className="text-sm">This deletes your PrepWise account, not your Google account.</p>
        <label className="block text-sm">Type DELETE to confirm
          <input value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={loading} autoComplete="off"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-white/20" />
        </label>
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={close} disabled={loading} className="rounded-xl border px-4 py-2 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={loading || confirmation !== 'DELETE'} className="rounded-xl bg-rose-600 px-4 py-2 text-white disabled:opacity-50">
            {loading ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </form>
    </dialog>
  </>;
}
