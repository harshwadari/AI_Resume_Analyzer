import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { getAnalysis } from '../services/analysis.api';

export default function AnalysisOverview() {
  const { analysisId } = useParams();
  const { user } = useAuth();
  return <SavedAnalysis key={`${user.id}:${analysisId}`} analysisId={analysisId} />;
}

function SavedAnalysis({ analysisId }) {
  const [state, setState] = useState({ loading: true, analysis: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getAnalysis(analysisId, { signal: controller.signal }).then(analysis => {
      if (!controller.signal.aborted) setState({ loading: false, analysis, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted && error.code !== 'ERR_CANCELED') setState({ loading: false, analysis: null, error: error.response?.data?.message || 'Unable to load this analysis.' });
    });
    return () => controller.abort();
  }, [analysisId, attempt]);

  return <section aria-labelledby="recruiter-page-title" className="glass-panel-strong rounded-[32px] p-6 sm:p-8">
    <h2 id="recruiter-page-title" className="text-2xl font-semibold">Analysis overview</h2>
    {state.loading && <p role="status" className="mt-4 text-sm">Loading saved JD…</p>}
    {state.error && <div className="mt-4"><p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{state.error}</p><button type="button" className="mt-3 rounded-lg border px-4 py-2 text-sm" onClick={() => { setState({ loading: true, analysis: null, error: '' }); setAttempt(value => value + 1); }}>Retry</button></div>}
    {state.analysis && <>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500 dark:text-slate-400">Analysis ID</dt><dd className="mt-1 break-all">{state.analysis.id}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Source type</dt><dd className="mt-1">{state.analysis.sourceType}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd className="mt-1">Draft · processing not started</dd></div>
      </dl>
      <h3 className="mt-8 text-lg font-semibold">Original job description</h3>
      <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-400">Saved exactly as submitted. This read-only original remains the source of truth.</p>
      <pre className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-slate-200 p-5 font-sans text-sm leading-7 dark:border-white/10">{state.analysis.rawJDText}</pre>
    </>}
    <Link to="/recruiter/analysis/new" className="mt-6 inline-block rounded-lg text-sm font-semibold text-fuchsia-700 underline dark:text-fuchsia-300">Create a new analysis</Link>
  </section>;
}
