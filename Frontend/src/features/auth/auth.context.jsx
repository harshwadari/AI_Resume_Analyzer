import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthContext } from './auth.state';
import { getMe } from '../../services/auth.api';
import { advanceSession, sessionEpoch } from '../../services/session';

export const AuthProvider = ({ children }) => {
  const [user, updateUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const channel = useRef(null);
  const generation = useRef(0);
  const currentUser = useRef(null);

  const setUser = useCallback(value => {
    generation.current++;
    advanceSession();
    currentUser.current = value;
    updateUser(value);
    setInitialLoading(false);
    channel.current?.postMessage('changed');
  }, []);

  useEffect(() => {
    let active = true;
    let controller;
    // One-time compatibility cleanup. No authentication credential is read.
    try {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    } catch { /* Storage may be disabled; cookie authentication still works. */ }
    const url = new URL(window.location.href);
    if (url.searchParams.has('token')) {
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      const revision = ++generation.current;
      const epoch = sessionEpoch();
      try {
        const data = await getMe({ signal: controller.signal });
        if (active && revision === generation.current && epoch === sessionEpoch()) {
          const nextUser = data.user || null;
          if (currentUser.current?.id !== nextUser?.id) advanceSession();
          currentUser.current = nextUser;
          updateUser(nextUser);
          setInitialLoading(false);
        }
      } catch (err) {
        if (active && revision === generation.current && epoch === sessionEpoch() && err.code !== 'ERR_CANCELED') {
          currentUser.current = null;
          advanceSession();
          updateUser(null);
          setInitialLoading(false);
          if (err.response?.status !== 401) setError('Unable to check your session. Please try again.');
        }
      } finally {
        if (active && revision === generation.current && epoch === sessionEpoch()) setInitialLoading(false);
      }
    };
    const unauthorized = () => {
      setUser(null);
      setError('Your session ended. Please sign in again.');
    };
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('prepwise-auth');
      channel.current.onmessage = () => {
        advanceSession();
        currentUser.current = null;
        updateUser(null);
        setInitialLoading(true);
        void refresh();
      };
    }
    const onFocus = () => { void refresh(); };
    window.addEventListener('auth:unauthorized', unauthorized);
    window.addEventListener('focus', onFocus);
    void refresh();
    return () => {
      active = false;
      controller?.abort();
      channel.current?.close();
      channel.current = null;
      window.removeEventListener('auth:unauthorized', unauthorized);
      window.removeEventListener('focus', onFocus);
    };
  }, [setUser]);

  return <AuthContext.Provider value={{ user, setUser, loading, setLoading, initialLoading, error, setError }}>
    {children}
  </AuthContext.Provider>;
};
