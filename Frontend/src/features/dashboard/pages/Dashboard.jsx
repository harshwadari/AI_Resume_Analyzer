import { ArrowRight, BriefcaseBusiness, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import WorkspaceHeader from '../../../components/layout/WorkspaceHeader.jsx';

const sections = [
  { title: 'Recruiter', to: '/recruiter', icon: BriefcaseBusiness, description: 'A dedicated space for your recruiting workflow.', action: 'Open recruiter dashboard', comingSoon: true },
  { title: 'Candidate', to: '/workspace', icon: UserRound, description: 'Turn your resume and target role into a focused interview preparation plan.', action: 'Open candidate workspace' },
];

export default function Dashboard() {
  return <main className="page-shell px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <WorkspaceHeader badge="PrepWise AI" title="Choose your workspace" subtitle="Where would you like to start? You can switch between sections at any time." />
      <div className="grid gap-6 md:grid-cols-2">
        {sections.map(({ title, to, icon, description, action, comingSoon }) => {
          const Icon = icon;
          return (
          <Link key={to} to={to} aria-label={title} className="glass-panel-strong group flex flex-col rounded-[32px] p-6 transition duration-200 hover:border-fuchsia-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30 motion-safe:hover:-translate-y-1 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-fuchsia-500/10 p-4 text-fuchsia-600 dark:text-fuchsia-300"><Icon size={28} aria-hidden="true" /></div>
              {comingSoon && <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">Coming soon</span>}
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-slate-950 dark:text-white">{title}</h2>
            <p className="mb-8 mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{description}</p>
            <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-600 dark:text-fuchsia-300">{action}<ArrowRight size={18} aria-hidden="true" /></span>
          </Link>
          );
        })}
      </div>
    </div>
  </main>;
}
