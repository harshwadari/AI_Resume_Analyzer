import { BriefcaseBusiness } from 'lucide-react';
import WorkspaceHeader from '../../../components/layout/WorkspaceHeader.jsx';

export default function Recruiter() {
  return <main className="page-shell px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <WorkspaceHeader badge="Recruiter" title="Recruiter dashboard" showBack backTo="/dashboard" />
      <section className="glass-panel-strong rounded-[32px] px-6 py-16 text-center sm:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300"><BriefcaseBusiness size={28} aria-hidden="true" /></div>
        <h2 className="mt-6 text-xl font-semibold">Your recruiter workspace is coming soon</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">Recruiter tools will appear here when they are ready.</p>
      </section>
    </div>
  </main>;
}
