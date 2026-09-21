import { useState } from 'react';
import { ArrowRight, FileSearch, Files, ListChecks, Plus, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import AnalysisCard from '../../recruiter/components/AnalysisCard.jsx';
import { sampleAnalyses } from '../../recruiter/data/sampleAnalyses.js';

const steps = [
  { icon: FileSearch, title: 'Define the role', description: 'Start with a job description and review the requirements.' },
  { icon: Files, title: 'Add candidate resumes', description: 'Bring the resumes you want to compare against the role.' },
  { icon: ListChecks, title: 'Review the evidence', description: 'Explore matches and decide who to move forward with.' },
];

export default function Recruiter() {
  const [showSamples, setShowSamples] = useState(false);

  return <div className="space-y-6">
    <section aria-labelledby="recruiter-intro-title" className="glass-panel-strong relative overflow-hidden rounded-[32px] p-6 sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-300">Recruiter workspace</p>
          <h2 id="recruiter-intro-title" className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl dark:text-white">Find the right match. See the evidence.</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-400">A dedicated space to compare resumes with a role, understand candidate strengths, and keep your review organized.</p>
        </div>
        <Link to="/recruiter/analysis/new" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/15 transition hover:bg-fuchsia-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30">
          <Plus size={18} aria-hidden="true" />New Analysis
        </Link>
      </div>
      <ol className="relative mt-8 grid gap-5 border-t border-slate-200/70 pt-6 md:grid-cols-3 dark:border-white/10">
        {steps.map(({ icon, title, description }, index) => {
          const Icon = icon;
          return <li key={title} className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"><Icon size={19} aria-hidden="true" /></div>
          <div>
            <h3 className="text-sm font-semibold"><span className="mr-1 text-slate-500 dark:text-slate-400">0{index + 1}.</span> {title}</h3>
            <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-400">{description}</p>
          </div>
        </li>;
        })}
      </ol>
    </section>

    <section id="analyses" aria-labelledby="recruiter-analyses-title" className="glass-panel-strong scroll-mt-6 overflow-hidden rounded-[32px]">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200/70 p-6 sm:flex-row sm:items-center sm:px-8 dark:border-white/10">
        <div>
          <h2 id="recruiter-analyses-title" className="text-xl font-semibold">Recent analyses</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">Track status, resume counts, requested Top-K, and completion in one place.</p>
        </div>
        <button type="button" onClick={() => setShowSamples(value => !value)} aria-expanded={showSamples} aria-controls="recruiter-analysis-content" className="shrink-0 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium transition hover:bg-slate-500/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30 dark:border-white/15">
          {showSamples ? 'Hide sample preview' : 'Preview sample analyses'}
        </button>
      </div>
      <div id="recruiter-analysis-content">
        {showSamples ? <div className="p-6 sm:p-8">
          <div role="status" className="mb-5 rounded-2xl border border-amber-300/60 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/25 dark:text-amber-200">
            <strong>Sample preview</strong> — These fictional analyses demonstrate the dashboard layout. They are not your data, and no resumes have been processed.
          </div>
          <ul className="space-y-4" aria-label="Sample analyses">
            {sampleAnalyses.map(analysis => <li key={analysis.id}><AnalysisCard analysis={analysis} isSample /></li>)}
          </ul>
        </div> : <div className="flex flex-col items-center px-6 py-14 text-center sm:py-16">
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-fuchsia-200/60 bg-fuchsia-500/5 text-fuchsia-600 dark:border-fuchsia-500/20 dark:text-fuchsia-300">
            <FileSearch size={34} strokeWidth={1.5} aria-hidden="true" />
            <span aria-hidden="true" className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-fuchsia-600 text-white"><Plus size={17} /></span>
          </div>
          <h3 className="text-lg font-semibold">Your next candidate search starts here</h3>
          <p className="mt-3 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-400">Start a new analysis to save your job description. Open the saved original from the confirmation in your workflow.</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-500/10 px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Saved analysis history is coming soon<ArrowRight size={14} aria-hidden="true" /></p>
        </div>}
      </div>
    </section>

    <p className="flex items-start gap-2 px-2 text-xs leading-6 text-slate-600 dark:text-slate-400"><ShieldCheck size={17} className="mt-1 shrink-0" aria-hidden="true" />Built for informed review. Matching evidence supports your judgment; hiring decisions stay with you.</p>
  </div>;
}
