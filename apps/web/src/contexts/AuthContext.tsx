import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { setApiToken } from '../lib/api';

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

  // Try to refresh token on mount (uses httpOnly cookie)
  useEffect(() => {
    const API_BASE = (import.meta.env.VITE_API_BASE_URL as string ?? '/api').replace(/\/$/, '');
    fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.accessToken) {
          setAccessToken(data.accessToken);
        }
      })
      .catch(() => {
        // Refresh failed — user needs to log in
      })
      .finally(() => setLoading(false));
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
