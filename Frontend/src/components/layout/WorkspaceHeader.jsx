import { ArrowLeft, LogOut, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../ui/ThemeToggle.jsx";
import { useAuth } from "../../features/auth/hooks/useAuth";

const WorkspaceHeader = ({ title, subtitle, showBack = false }) => {
  const navigate = useNavigate();
  const { handleLogout, loading } = useAuth();

  const onLogout = async () => {
    await handleLogout();
    navigate("/");
  };

  return (
    <header className="glass-panel mb-8 rounded-[28px] px-6 py-5 sm:px-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {showBack && (
            <Link
              to="/workspace"
              className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/60 bg-white/80 text-slate-700 backdrop-blur-md transition hover:bg-white dark:border-white/10 dark:bg-slate-800/80 dark:text-blue-400 dark:hover:bg-slate-800"
            >
              <ArrowLeft size={18} />
            </Link>
          )}

          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 backdrop-blur-md dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
              <Sparkles size={14} className="text-blue-500 dark:text-blue-400" />
              Interview workspace
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          <button
            type="button"
            onClick={onLogout}
            disabled={loading}
            className="group inline-flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/80 px-5 py-2.5 text-sm font-medium text-slate-700 backdrop-blur-md transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 dark:border-blue-500/20 dark:bg-slate-800/80 dark:text-white dark:hover:bg-blue-500/10"
          >
            <LogOut
              size={16}
              className="text-slate-600 dark:text-blue-400"
            />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default WorkspaceHeader;
