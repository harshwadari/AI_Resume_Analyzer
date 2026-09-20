import { useEffect, useRef, useState } from 'react';
import './auth-success.css';

export default function AuthSuccess({ onComplete }) {
  const [seconds, setSeconds] = useState(3);
  const completed = useRef(false);
  useEffect(() => {
    const timers = [
      setTimeout(() => setSeconds(2), 1000),
      setTimeout(() => setSeconds(1), 2000),
      setTimeout(() => {
        if (completed.current) return;
        completed.current = true;
        setSeconds(0);
        onComplete();
      }, 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return <main className="page-shell flex min-h-screen items-center justify-center p-6">
    <div role="status" aria-live="polite" aria-atomic="true" className="glass-panel w-full max-w-md rounded-3xl p-8 text-center">
      <svg aria-hidden="true" viewBox="0 0 48 48" className="mx-auto h-12 w-12 text-emerald-500">
        <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.12" />
        <path className="auth-success-check" d="m14 24 7 7 14-14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h1 className="mt-4 text-xl font-semibold">Authentication successful</h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Redirecting to your dashboard in <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{seconds}</span>…</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose Recruiter or Candidate on the next screen.</p>
    </div>
  </main>;
}
