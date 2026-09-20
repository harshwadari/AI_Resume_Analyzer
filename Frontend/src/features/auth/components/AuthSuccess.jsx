import { useEffect } from 'react';
import './auth-success.css';

export default function AuthSuccess({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 900);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return <main className="page-shell flex min-h-screen items-center justify-center p-6">
    <div role="status" className="glass-panel rounded-3xl p-8 text-center">
      <svg aria-hidden="true" viewBox="0 0 48 48" className="mx-auto h-12 w-12 text-emerald-500">
        <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.12" />
        <path className="auth-success-check" d="m14 24 7 7 14-14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="mt-3 font-semibold">You’re signed in!</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Opening your workspace…</p>
    </div>
  </main>;
}
