import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WorkspaceHeader from '../../../components/layout/WorkspaceHeader.jsx';
import ThemeToggle from '../../../components/ui/ThemeToggle.jsx';
import DeleteAccount from '../../auth/components/DeleteAccount';
import { useAuth } from '../../auth/hooks/useAuth';

export function SettingsContent() {
  const { handleLogout, loading } = useAuth();
  const navigate = useNavigate();
  const onLogout = async () => {
    const result = await handleLogout();
    navigate(result.success ? '/' : '/login', { state: { logoutFailed: !result.success } });
  };

  return <section aria-labelledby="settings-title" className="glass-panel-strong rounded-[32px] p-6 sm:p-8">
    <h2 id="settings-title" className="text-xl font-semibold">Account settings</h2>
    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">Manage your appearance and account in one place, across both workspaces.</p>
    <div className="mt-6 divide-y divide-slate-200/70 dark:divide-white/10">
      <div className="flex flex-col items-start justify-between gap-4 py-6 sm:flex-row sm:items-center">
        <div><h3 className="text-base font-semibold">Appearance</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Choose light or dark mode.</p></div>
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-start justify-between gap-4 py-6 sm:flex-row sm:items-center">
        <div><h3 className="text-base font-semibold">Session</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Sign out of your PrepWise account on all sessions.</p></div>
        <button type="button" onClick={onLogout} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/80 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-slate-800/80 dark:text-white dark:hover:bg-slate-700"><LogOut size={16} aria-hidden="true" />Logout</button>
      </div>
      <div className="flex flex-col items-start justify-between gap-4 py-6 sm:flex-row sm:items-center">
        <div><h3 className="text-base font-semibold text-rose-700 dark:text-rose-300">Delete account</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Permanently delete your account. You will be asked to confirm.</p></div>
        <DeleteAccount />
      </div>
    </div>
  </section>;
}

export default function Settings() {
  return <main className="page-shell px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">
    <WorkspaceHeader badge="PrepWise AI" title="Settings" showBack backTo="/dashboard" />
    <SettingsContent />
  </div></main>;
}
