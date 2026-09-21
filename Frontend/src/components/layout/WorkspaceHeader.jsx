import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import ProfileMenu from './ProfileMenu.jsx';

const WorkspaceHeader = ({ title, subtitle, showBack = false, backTo = '/workspace', badge = 'Interview workspace' }) => {
  return (
    <header className="glass-panel relative z-20 mb-8 rounded-[28px] px-6 py-5 sm:px-7">
      <div className="flex items-start justify-between gap-3 sm:gap-5">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {showBack && (
            <Link
              to={backTo}
              aria-label={backTo === '/dashboard' ? 'Back to dashboard selection' : 'Back to workspace'}
              className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/60 bg-white/80 text-slate-700 backdrop-blur-md transition hover:bg-white dark:border-white/10 dark:bg-slate-800/80 dark:text-blue-400 dark:hover:bg-slate-800"
            >
              <ArrowLeft size={18} />
            </Link>
          )}

          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 backdrop-blur-md dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
              <Sparkles size={14} className="text-blue-500 dark:text-blue-400" />
              {badge}
            </div>

            <h1 className="mt-4 break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <ProfileMenu />
      </div>
    </header>
  );
};

export default WorkspaceHeader;
