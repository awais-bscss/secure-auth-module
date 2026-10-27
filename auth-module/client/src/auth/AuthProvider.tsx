import React, { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, AuthStatus } from './useAuth';
import { User, LoginCredentials, login as apiLogin, logout as apiLogout, refresh as apiRefresh, me as apiMe } from '../api/auth';
import { clearAccessToken } from '../api/tokenStore';
import { setOnAuthFailure } from '../api/client';
import { AppError } from '../api/errors';

function decodeTokenExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    return parsed.exp ? parsed.exp * 1000 : null; // in ms
  } catch {
    return null;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoggingOutRef = useRef(false);
  const navigate = useNavigate();

  const clearTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const handleSessionExpiry = useCallback(() => {
    if (isLoggingOutRef.current) {
      return;
    }
    clearTimer();
    clearAccessToken();
    setUser(null);
    setStatus((prev) => {
      // Only show banner if the user had an active session
      if (prev === 'authenticated') {
        setSessionExpiredMessage('Session expired, please log in again');
      }
      return 'unauthenticated';
    });
    navigate('/login', { replace: true });
  }, [clearTimer, navigate]);

  const scheduleSilentRefresh = useCallback(
    (token: string) => {
      clearTimer();
      const expMs = decodeTokenExp(token);
      if (!expMs) return;

      const now = Date.now();
      const timeRemaining = expMs - now;

      // Schedule silent refresh 30 seconds before expiry
      let delay = timeRemaining - 30 * 1000;
      if (delay <= 0) {
        delay = timeRemaining > 0 ? Math.max(timeRemaining * 0.7, 1000) : 5000;
      }

      refreshTimerRef.current = setTimeout(async () => {
        try {
          const newAccessToken = await apiRefresh();
          scheduleSilentRefresh(newAccessToken);
        } catch (err) {
          if (err instanceof AppError && (err.status === 401 || err.status === 403)) {
            handleSessionExpiry();
            return;
          }
          scheduleSilentRefresh(token);
        }
      }, delay);
    },
    [clearTimer, handleSessionExpiry]
  );

  const scheduleSilentRefreshRef = useRef(scheduleSilentRefresh);
  scheduleSilentRefreshRef.current = scheduleSilentRefresh;

  // Auth failure callback
  useEffect(() => {
    setOnAuthFailure(() => {
      handleSessionExpiry();
    });
  }, [handleSessionExpiry]);

  // Restore session on initial mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const token = await apiRefresh();
        if (!isMounted) return;

        const profile = await apiMe();
        if (!isMounted) return;

        setUser(profile);
        setStatus('authenticated');
        scheduleSilentRefreshRef.current(token);
      } catch {
        if (!isMounted) return;
        clearAccessToken();
        setUser(null);
        setStatus('unauthenticated');
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
      clearTimer();
    };
  }, [clearTimer]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setSessionExpiredMessage(null);
      const data = await apiLogin(credentials);
      setUser(data.user);
      setStatus('authenticated');
      scheduleSilentRefresh(data.accessToken);
    },
    [scheduleSilentRefresh]
  );

  const logout = useCallback(async () => {
    isLoggingOutRef.current = true;
    clearTimer();
    setSessionExpiredMessage(null);
    clearAccessToken();
    setUser(null);
    setStatus('unauthenticated');
    navigate('/login', { replace: true });

    try {
      await apiLogout();
    } finally {
      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 1000);
    }
  }, [clearTimer, navigate]);

  const clearSessionExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null);
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      status,
      login,
      logout,
      sessionExpiredMessage,
      clearSessionExpiredMessage,
    }),
    [user, status, login, logout, sessionExpiredMessage, clearSessionExpiredMessage]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
