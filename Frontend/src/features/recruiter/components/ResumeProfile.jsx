import { useEffect, useRef, useState } from 'react';
import { getResumeProfile } from '../services/analysis.api';

const label = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());
function Value({ value }) {
  if (value === null || value === undefined || (Array.isArray(value) && !value.length)) return <span className="text-slate-500 dark:text-slate-400">Unknown / not stated</span>;
  if (Array.isArray(value)) return <ul className="space-y-3">{value.map((item, index) => <li key={index}><Value value={item} /></li>)}</ul>;
  if (typeof value === 'object') return <dl className="space-y-2 rounded-xl border border-slate-300/50 p-3 dark:border-white/10">{Object.entries(value).map(([key, item]) => <div key={key}><dt className="font-semibold">{label(key)}</dt><dd className="whitespace-pre-wrap break-words"><Value value={item} /></dd></div>)}</dl>;
  return <span>{String(value)}</span>;
}

export default function ResumeProfile({ analysisId, resumeId }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const show = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (data) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try {
      const result = await getResumeProfile(analysisId, resumeId, { signal: controller.signal });
      if (!controller.signal.aborted) setData(result);
    } catch {
      if (!controller.signal.aborted) setError('Unable to load this profile. Close and reopen to retry.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <div className="mt-3">
    <button type="button" aria-expanded={open} aria-controls={`profile-${resumeId}`} disabled={busy} onClick={show} className="rounded-lg border border-fuchsia-400/50 px-3 py-2 font-semibold text-fuchsia-700 dark:text-fuchsia-300">{open ? 'Close candidate profile' : 'View candidate profile'}</button>
    {open && <section id={`profile-${resumeId}`} aria-label="Extracted candidate profile" className="mt-3 space-y-4 rounded-xl bg-slate-500/5 p-4">
      {busy && <p role="status">Loading profile…</p>}{error && <p role="alert">{error}</p>}
      {data && <><p className="text-slate-600 dark:text-slate-400">Extracted information for recruiter review. Unknown means not stated; verify details against the source evidence.</p>
        {data.candidateProfile ? <Value value={Object.fromEntries(Object.entries(data.candidateProfile).filter(([key]) => key !== 'rawText'))} /> : <p>No structured profile yet. Upload and process this resume with the updated worker.</p>}
        <p className="break-words text-xs text-slate-500 dark:text-slate-400">Parser: {data.parserVersion || 'Unknown'} · Model: {data.modelVersion || 'Unknown'}</p>
        <details><summary className="cursor-pointer font-semibold">Source chunks ({data.chunks.length})</summary><ol className="mt-3 space-y-3">{data.chunks.map(chunk => <li key={chunk.chunkIndex} className="rounded-lg border p-3 dark:border-white/10"><p className="font-semibold">{label(chunk.section.replaceAll('_', ' '))} · Pages {chunk.pageStart}–{chunk.pageEnd}</p><p className="mt-2 whitespace-pre-wrap break-words">{chunk.text}</p></li>)}</ol></details>
        <details><summary className="cursor-pointer font-semibold">Original extracted text</summary><p className="mt-2 whitespace-pre-wrap break-words">{data.rawText}</p></details>
      </>}
    </section>}
  </div>;
}
