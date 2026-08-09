import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { API_BASE, setApiToken } from '../lib/api';

interface AuthContextValue {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  isAuthenticated: boolean;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Token lives in React state only — never localStorage (security requirement)
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync token with API client whenever it changes
  useEffect(() => {
    setApiToken(accessToken);
  }, [accessToken]);

  // Try to refresh token on mount (uses httpOnly cookie).
  // Timeout + abort so a dead/unreachable API can't leave the app stuck on "Loading…".
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.accessToken) {
          setAccessToken(data.accessToken);
        }
      })
      .catch(() => {
        // Refresh failed (network error, timeout, 4xx/5xx…) — user needs to log in.
      })
      .finally(() => {
        clearTimeout(timer);
        setLoading(false);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-[#0f0f1a]" role="status" aria-live="polite">
        <div className="text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ accessToken, setAccessToken, isAuthenticated: accessToken !== null, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
