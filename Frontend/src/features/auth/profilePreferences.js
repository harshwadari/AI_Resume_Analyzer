const keyFor = userId => `prepwise-profile:${userId}`;

export function readProfilePreferences(userId) {
  if (!userId) return {};
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(userId)) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch { return {}; }
}

export function applyProfilePreferences(user) {
  if (!user?.id) return user;
  const preferences = readProfilePreferences(user.id);
  return { ...user, ...(preferences.name ? { username: preferences.name } : {}), ...(preferences.avatar ? { avatar: preferences.avatar } : {}) };
}

export function saveProfilePreferences(userId, preferences) {
  const current = readProfilePreferences(userId);
  const next = { ...current, ...preferences };
  try { localStorage.setItem(keyFor(userId), JSON.stringify(next)); } catch { throw new Error('Profile changes could not be saved in this browser.'); }
  return next;
}

export function clearProfileAvatar(userId) {
  const current = readProfilePreferences(userId);
  delete current.avatar;
  try { localStorage.setItem(keyFor(userId), JSON.stringify(current)); } catch { /* Optional browser storage. */ }
}
