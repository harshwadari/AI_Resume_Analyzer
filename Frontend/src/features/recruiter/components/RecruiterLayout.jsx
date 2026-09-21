import { Link, NavLink, Outlet, useMatch } from 'react-router-dom';
import WorkspaceHeader from '../../../components/layout/WorkspaceHeader.jsx';

const linkStyle = 'rounded-xl px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30';
const navigationStyle = ({ isActive }) => `${linkStyle} ${isActive ? 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300' : 'text-slate-600 hover:bg-slate-500/10 dark:text-slate-300'}`;

export default function RecruiterLayout() {
  const match = useMatch('/recruiter/analysis/:analysisId/*');
  const analysisId = match?.params.analysisId;
  const analysisPath = analysisId && analysisId !== 'new'
    ? `/recruiter/analysis/${encodeURIComponent(analysisId)}`
    : null;

  return <main className="page-shell px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <WorkspaceHeader badge="Recruiter" title="Recruiter dashboard" showBack backTo="/dashboard" />
      <nav aria-label="Recruiter navigation" className="glass-panel mb-6 flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <NavLink to="/recruiter" end className={navigationStyle}>Dashboard</NavLink>
        <Link to="/recruiter#analyses" className={linkStyle}>Analyses</Link>
        {analysisPath && <NavLink to={analysisPath} end className={navigationStyle}>Analysis overview</NavLink>}
        {analysisPath ? <>
          <NavLink to={`${analysisPath}/candidates`} className={navigationStyle}>Candidates / results</NavLink>
          <NavLink to={`${analysisPath}/chat`} className={navigationStyle}>Chat</NavLink>
        </> : <button type="button" disabled title="Open an analysis to view its candidates and results" className={`${linkStyle} cursor-not-allowed opacity-50`}>Candidates / results</button>}
        <button type="button" disabled className={`${linkStyle} cursor-not-allowed opacity-50`}>Settings (coming soon)</button>
      </nav>
      <Outlet />
    </div>
  </main>;
}
