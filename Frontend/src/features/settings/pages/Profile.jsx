import { ImagePlus, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import WorkspaceHeader from '../../../components/layout/WorkspaceHeader.jsx';
import { useAuth } from '../../auth/hooks/useAuth';
import { clearProfileAvatar } from '../../auth/profilePreferences';

export default function Profile() {
  return <main className="page-shell px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">
    <WorkspaceHeader badge="PrepWise AI" title="Profile" showBack backTo="/dashboard" />
    <ProfileEditor />
  </div></main>;
}

function ProfileEditor() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const picker = useRef(null);
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showMessage = text => {
    clearTimeout(toastTimer.current);
    setMessage(text);
    toastTimer.current = setTimeout(() => setMessage(''), 3000);
  };
  const saveProfile = event => {
    event.preventDefault(); setMessage(''); setError('');
    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 50) { setError('Profile name must be between 2 and 50 characters.'); return; }
    const result = updateProfile({ name: cleanName, avatar });
    if (result.success) { if (!avatar) clearProfileAvatar(user.id); showMessage('Profile saved successfully.'); } else setError(result.message);
  };
  const chooseAvatar = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (file.size > 1024 * 1024) { setError('Profile pictures must be 1 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setAvatar(String(reader.result)); setError(''); showMessage('Preview ready. Save your profile to keep it.'); };
    reader.readAsDataURL(file);
  };
  const removeAvatar = () => { setAvatar(''); showMessage('Avatar removed from the preview. Save your profile to confirm.'); };

  return <section aria-labelledby="profile-title" className="glass-panel-strong rounded-[32px] p-6 sm:p-8">
    <h2 id="profile-title" className="text-xl font-semibold">Edit profile</h2>
    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">Update the basic information shown in your profile menu. No cover or banner image is used.</p>
    <form onSubmit={saveProfile} className="mt-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div><h3 className="text-base font-semibold">Profile picture</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Use an image up to 1 MB.</p></div>
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-fuchsia-300/60 bg-fuchsia-500/10 text-xl font-semibold text-fuchsia-700 dark:text-fuchsia-200">{avatar ? <img src={avatar} alt="Profile preview" className="h-full w-full object-cover" /> : <UserRound size={26} aria-hidden="true" />}</div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => picker.current?.click()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-fuchsia-500/10"><ImagePlus size={16} aria-hidden="true" />Choose picture</button>{avatar && <button type="button" onClick={removeAvatar} className="inline-flex items-center gap-2 rounded-xl border border-rose-300/60 px-3 py-2 text-sm text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"><X size={16} aria-hidden="true" />Remove</button>}</div>
          <input ref={picker} type="file" accept="image/*" onChange={chooseAvatar} className="sr-only" />
        </div>
      </div>
      <label className="mt-6 block max-w-xl text-sm font-medium">Profile name<input value={name} maxLength={50} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-3 text-sm dark:border-white/15 dark:bg-slate-900/70" /></label>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <button type="submit" className="mt-5 rounded-xl bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white hover:bg-fuchsia-700">Save profile</button>
    </form>
    {message && <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-xl dark:border-emerald-500/30 dark:bg-emerald-950/90 dark:text-emerald-200">{message}</div>}
  </section>;
}
