import { ArrowUpRight, BriefcaseBusiness } from 'lucide-react';
import { Link } from 'react-router-dom';

const statuses = {
  completed: { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300', progress: 'bg-emerald-500' },
  processing: { label: 'Processing', color: 'bg-blue-500/10 text-blue-800 dark:text-blue-300', progress: 'bg-blue-500' },
  draft: { label: 'Draft', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', progress: 'bg-slate-400' },
  failed: { label: 'Failed', color: 'bg-rose-500/10 text-rose-800 dark:text-rose-300', progress: 'bg-rose-500' },
};

export default function AnalysisCard({ analysis, isSample = false }) {
  const status = statuses[analysis.status] || { label: 'Unknown', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', progress: 'bg-slate-400' };
  const progress = analysis.resumeCount > 0 ? Math.min(100, Math.max(0, Math.round(analysis.processedCount / analysis.resumeCount * 100))) : 0;

  return <article className="rounded-2xl border border-slate-200/80 bg-white/40 p-5 sm:p-6 dark:border-white/10 dark:bg-white/[0.02]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-500 dark:text-slate-400"><BriefcaseBusiness size={19} aria-hidden="true" /></div>
        <div>
          <h3 className="break-words text-base font-semibold text-slate-950 dark:text-white">{analysis.title}</h3>
          {isSample && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fictional analysis · sample data</p>}
        </div>
      </div>
      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${status.color}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{status.label}</span>
    </div>
    <dl className="mt-5 grid gap-4 border-t border-slate-200/70 pt-4 sm:grid-cols-[1fr_1fr_2fr] dark:border-white/10">
      <div><dt className="text-xs text-slate-500 dark:text-slate-400">Resume count</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{analysis.resumeCount} resumes</dd></div>
      <div><dt className="text-xs text-slate-500 dark:text-slate-400">Requested Top-K</dt><dd className="mt-1 text-sm font-semibold">{analysis.topK == null ? 'All candidates' : `Top ${analysis.topK}`}</dd></div>
      <div>
        <dt className="text-xs text-slate-500 dark:text-slate-400">Completion status</dt>
        <dd className="mt-1 text-sm font-medium">{analysis.completion}</dd>
        <div role="progressbar" aria-label={`${analysis.title}: resumes processed${isSample ? ' (sample)' : ''}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${analysis.processedCount} of ${analysis.resumeCount} resumes processed`} className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className={`h-full rounded-full ${status.progress}`} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </dl>
    {!isSample && <Link to={`/recruiter/analysis/${encodeURIComponent(analysis.id)}`} className="mt-4 inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-fuchsia-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30 dark:text-fuchsia-300">View analysis<ArrowUpRight size={16} aria-hidden="true" /></Link>}
  </article>;
}
