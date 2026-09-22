import { useEffect, useRef, useState } from 'react';
import { extractRequirements, reviewRequirements } from '../services/analysis.api';

const fields = [
  ['title', 'Job title'], ['requiredSkills', 'Required skills'], ['preferredSkills', 'Preferred skills'],
  ['minimumExperience', 'Minimum experience (years)'], ['maximumExperience', 'Maximum experience (years)'],
  ['education', 'Education'], ['certifications', 'Certifications'], ['responsibilities', 'Responsibilities'],
  ['domain', 'Domain'], ['location', 'Location'], ['employmentType', 'Employment type'],
];

export default function RequirementsReview({ analysis }) {
  const [saved, setSaved] = useState(analysis);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const run = async action => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError('');
    try {
      const result = await action(saved.id, { signal: controller.signal });
      if (!controller.signal.aborted) setSaved(result);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.response?.data?.message || 'Unable to save requirements. Please retry.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  };
  return <section aria-label="Job requirements review" className="mt-6 rounded-2xl border border-fuchsia-300/60 bg-fuchsia-500/5 p-5 dark:border-fuchsia-500/30">
    <h3 className="text-lg font-semibold">Review job requirements</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">AI-extracted requirements may contain mistakes. Compare them with the original JD before candidate matching. Missing details are shown as not specified.</p>
    {!saved.structuredJD ? <button type="button" disabled={busy} onClick={() => run(extractRequirements)} className="mt-4 rounded-xl bg-fuchsia-600 px-4 py-3 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-50">{busy ? 'Extracting requirements…' : 'Extract requirements'}</button> : <>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        {fields.map(([key, label]) => {
          const value = saved.structuredJD[key];
          return <div key={key} className={key === 'responsibilities' ? 'sm:col-span-2' : ''}>
            <dt className="text-sm font-semibold">{label}</dt>
            <dd className="mt-2 break-words text-sm leading-6 text-slate-700 dark:text-slate-300">{Array.isArray(value)
              ? value.length ? <ul className="list-disc space-y-1 pl-5">{value.map((item, index) => <li key={index}>{item}</li>)}</ul> : 'Not specified'
              : value ?? 'Not specified'}</dd>
          </div>;
        })}
      </dl>
      <p className="mt-5 text-xs leading-6 text-slate-500 dark:text-slate-400">Extracted {new Date(saved.extractedAt).toLocaleString()} · {saved.modelName} · {saved.parserVersion}</p>
      {saved.requirementsReviewedAt
        ? <p role="status" className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">Requirements marked reviewed. Candidate matching is not available yet.</p>
        : <button type="button" disabled={busy} onClick={() => run(reviewRequirements)} className="mt-4 rounded-xl bg-fuchsia-600 px-4 py-3 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-50">{busy ? 'Saving review…' : 'Mark requirements reviewed'}</button>}
    </>}
    {busy && <p role="status" className="mt-3 text-sm">{saved.structuredJD ? 'Saving your review…' : 'Reading the job description. This may take up to a minute.'}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
  </section>;
}
