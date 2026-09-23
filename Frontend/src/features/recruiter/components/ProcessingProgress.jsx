import { useCallback, useEffect, useRef, useState } from 'react';
import { getProcessingProgress, startResumeProcessing } from '../services/analysis.api';

export default function ProcessingProgress({ analysisId, onProgress }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const mounted = useRef(true);
  const reading = useRef(false);
  const revision = useRef(0);
  const load = useCallback(async (signal) => {
    if (reading.current) return;
    reading.current = true;
    const current = revision.current;
    try {
      const next = await getProcessingProgress(analysisId, { signal });
      if (!signal.aborted && mounted.current && current === revision.current) { setJob(next); setError(''); onProgress?.(next); }
    } catch (failure) {
      if (!signal.aborted && mounted.current) setError(failure.response?.data?.message || 'Unable to load processing progress.');
    } finally { reading.current = false; }
  }, [analysisId, onProgress]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const initial = window.setTimeout(() => load(controller.signal), 0);
    const timer = window.setInterval(() => load(controller.signal), 2000);
    return () => { mounted.current = false; controller.abort(); window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);
  const start = async (retryFailed = false) => {
    revision.current += 1;
    setStarting(true); setError('');
    try {
      const next = await startResumeProcessing(analysisId, retryFailed);
      if (mounted.current) { setJob(next); onProgress?.(next); }
    } catch (failure) {
      if (mounted.current) setError(failure.response?.data?.message || 'Unable to start resume processing.');
    } finally { if (mounted.current) setStarting(false); }
  };
  if (!job) return <section aria-label="Resume processing" className="mt-6 rounded-2xl border border-slate-200 p-5 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Resume processing</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Queue uploaded resumes for controlled background processing.</p></div><button type="button" disabled={starting} onClick={() => start(false)} className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{starting ? 'Starting…' : 'Start processing'}</button></div>{error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}</section>;
  const percent = job.total ? Math.round((job.completed / job.total) * 100) : 0;
  const done = job.completed >= job.total;
  const ocrRequired = job.ocrRequired || 0;
  return <section aria-label="Resume processing" className="mt-6 rounded-2xl border border-slate-200 p-5 dark:border-white/10">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Resume processing</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{job.completed}/{job.total} complete · {job.processed} extracted · {ocrRequired} need OCR · {job.failed} failed · {job.queued} queued · {job.processing} processing</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${done ? ((job.failed || ocrRequired) ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300') : 'bg-blue-500/10 text-blue-800 dark:text-blue-300'}`}>{job.status}</span></div>
    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-500/10" role="progressbar" aria-valuemin="0" aria-valuemax={job.total} aria-valuenow={job.completed} aria-label="Resume processing progress"><div className="h-full rounded-full bg-fuchsia-600 transition-all" style={{ width: `${percent}%` }} /></div>
    <p className="mt-2 text-sm font-semibold" aria-live="polite">{job.completed}/{job.total} ({percent}%)</p>
    <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">Job ID: {job.id}. Complete includes extracted files, files needing OCR, and failed files.</p>
    {ocrRequired > 0 && <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">{ocrRequired} file{ocrRequired === 1 ? '' : 's'} need{ocrRequired === 1 ? 's' : ''} OCR. Review the individual statuses below. Original PDFs are preserved.</p>}
    {(done || job.dispatchError) && <button type="button" disabled={starting} onClick={() => start(false)} className="mt-4 mr-3 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{starting ? 'Starting…' : done ? 'Process new uploads' : 'Retry queue connection'}</button>}
    {job.dispatchError && <p role="alert" className="mt-3 text-sm text-amber-800 dark:text-amber-300">{job.dispatchError}</p>}
    {job.failed > 0 && <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">{job.failed} file{job.failed === 1 ? '' : 's'} failed. Review the individual statuses below and retry failed files when ready.</p>}
    {done && <button type="button" disabled={starting} onClick={() => start(true)} className="mt-4 rounded-xl border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50 dark:text-amber-300">{starting ? 'Retrying…' : 'Retry failed files'}</button>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
  </section>;
}
