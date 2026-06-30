import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, isDemoMode, setSessionSecurity, setUnauthorizedHandler } from './api';
import { demoSession, normalizeSession } from './auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(isDemoMode ? demoSession : null);
  const [status, setStatus] = useState(isDemoMode ? 'authenticated' : 'loading');
  const [notice, setNotice] = useState(null);

  const establishSession = useCallback((value) => {
    const nextSession = normalizeSession(value);
    if (!nextSession) throw new Error('The backend returned an invalid administrator session.');

    setSessionSecurity(nextSession);
    setSession(nextSession);
    setNotice(null);
    setStatus('authenticated');
    return nextSession;
  }, []);

  const clearSession = useCallback((message = null) => {
    setSessionSecurity(null);
    setSession(null);
    setNotice(message);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    const removeHandler = setUnauthorizedHandler((error) => {
      clearSession(error?.message || 'Your administrator session has expired.');
    });
    return removeHandler;
  }, [clearSession]);

  useEffect(() => {
    if (isDemoMode) {
      setSessionSecurity(demoSession);
      return undefined;
    }

    let active = true;
    api.getSession()
      .then((value) => {
        if (active) establishSession(value);
      })
      .catch((error) => {
        if (!active) return;
        clearSession(
          error?.status === 401
            ? null
            : error?.message || 'The dashboard could not verify the administrator session.',
        );
      });

    return () => {
      active = false;
    };
  }, [clearSession, establishSession]);

  const login = useCallback(async (password) => {
    setStatus('authenticating');
    setNotice(null);
    try {
      return establishSession(await api.login(password));
    } catch (error) {
      setSessionSecurity(null);
      setSession(null);
      setNotice(error?.message || 'Sign-in failed.');
      setStatus('anonymous');
      throw error;
    }
  }, [establishSession]);

  const logout = useCallback(async () => {
    if (isDemoMode) return;

    setStatus('signing-out');
    let message = null;
    try {
      await api.logout(session?.csrf_token);
    } catch {
      message = 'You were signed out locally, but the backend could not confirm the logout.';
    } finally {
      setSessionSecurity(null);
      setSession(null);
      setNotice(message);
      setStatus('anonymous');
    }
  }, [session]);

  const value = useMemo(
    () => ({
      session,
      status,
      notice,
      login,
      logout,
      dismissNotice: () => setNotice(null),
    }),
    [login, logout, notice, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
