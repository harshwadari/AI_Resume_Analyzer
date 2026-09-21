import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, UserRound } from 'lucide-react';
import { useAuth } from '../../features/auth/hooks/useAuth';

export default function ProfileMenu() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return null;
  return <ProfileDisclosure key={`${user.id}:${pathname}`} user={user} settingsPath={pathname.startsWith('/recruiter') ? '/recruiter/settings' : '/settings'} />;
}

function ProfileDisclosure({ user, settingsPath }) {
  const [open, setOpen] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState(null);
  const container = useRef(null);
  const trigger = useRef(null);
  const settingsLink = useRef(null);
  const profileLink = useRef(null);
  const panelId = useId();
  const name = user.username || user.name || user.email || 'Account';
  const initial = Array.from(name.trim())[0]?.toUpperCase() || 'A';
  const avatar = typeof user.avatar === 'string' ? user.avatar : null;

  useEffect(() => {
    if (!open) return;
    profileLink.current?.focus();
    const outside = event => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    const escape = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return <div ref={container} className="relative shrink-0" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-label="Open profile menu" aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(value => !value)}
      className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-fuchsia-300/60 bg-fuchsia-500/10 text-base font-semibold text-fuchsia-800 shadow-sm transition hover:bg-fuchsia-500/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30 dark:border-fuchsia-500/30 dark:text-fuchsia-200">
      {avatar && failedAvatar !== avatar
        ? <img src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setFailedAvatar(avatar)} className="h-full w-full object-cover" />
        : <span aria-hidden="true">{initial}</span>}
    </button>
    {open && <div id={panelId} className="glass-panel-strong absolute right-0 top-full z-50 mt-3 w-64 max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 p-2 shadow-xl dark:border-white/10">
      <div className="border-b border-slate-200/70 px-3 py-3 dark:border-white/10">
        <p className="break-words text-sm font-semibold text-slate-950 dark:text-white">{name}</p>
        {user.email && <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{user.email}</p>}
      </div>
      <nav aria-label="Profile actions" className="mt-1">
        <Link ref={profileLink} to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 hover:bg-fuchsia-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 dark:text-slate-200"><UserRound size={17} aria-hidden="true" />Profile <span className="sr-only">/ Edit Profile</span></Link>
        <Link ref={settingsLink} to={settingsPath} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 hover:bg-fuchsia-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 dark:text-slate-200"><Settings size={17} aria-hidden="true" />Settings</Link>
      </nav>
    </div>}
  </div>;
}
