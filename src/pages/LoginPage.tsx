import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../lib/api';

type Mode = 'login' | 'register';

const inputCls = [
  'w-full rounded-xl border border-black/10 dark:border-white/10',
  'bg-white/70 dark:bg-white/[0.06]',
  'px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100',
  'placeholder:text-gray-400 dark:placeholder:text-gray-500',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-transparent',
  'disabled:opacity-50 transition-colors',
].join(' ');

export default function LoginPage() {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-field validation errors from the API's `fields` payload (400 VALIDATION_ERROR),
  // rendered inline under each input instead of a single run-on sentence.
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // fetch with an abort timeout so a dead/unreachable API can't hang the UI forever.
  async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // Map non-2xx responses to friendly, actionable messages.
  function messageForErrorStatus(status: number, body: { message?: string; fields?: Record<string, string> }): string {
    if (status === 401) return 'Invalid email or password.';
    if (status === 429) return body.message ?? 'Too many attempts — please wait a few minutes and try again.';
    if (status >= 500) return 'Server error — please try again in a moment.';
    const detail = body.fields ? Object.values(body.fields).join('. ') : null;
    return detail ?? body.message ?? `Request failed (HTTP ${status})`;
  }

  // Pull human-readable per-field messages from a 400 VALIDATION_ERROR response body.
  function fieldMessagesFrom(body: { fields?: Record<string, string> }): { email?: string; password?: string } {
    const f = body.fields ?? {};
    const out: { email?: string; password?: string } = {};
    if (f.email) out.email = f.email;
    if (f.password) out.password = f.password;
    return out;
  }

  // Distinguish timeout / network failures from real server responses.
  function userFacingError(err: unknown): string {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'Request timed out — the server may be unreachable. Please try again.';
    }
    if (err instanceof TypeError) {
      // fetch rejects with TypeError when the network fails or the request is blocked
      return 'Cannot reach the server. Check your connection and try again.';
    }
    return err instanceof Error && err.message ? err.message : 'Something went wrong';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      if (mode === 'register') {
        const regRes = await fetchWithTimeout(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });

        if (!regRes.ok) {
          const body = await regRes.json().catch(() => ({}));
          console.error('Registration failed', { status: regRes.status, body });

          // Duplicate email → show it under the email field, not the banner.
          if (regRes.status === 409) {
            setFieldErrors({ email: 'That email is already registered.' });
            return;
          }

          // Field-level validation errors → render inline next to the controls.
          const fields = fieldMessagesFrom(body);
          if (fields.email || fields.password) {
            setFieldErrors(fields);
            return;
          }

          throw new Error(messageForErrorStatus(regRes.status, body));
        }
      }

      const loginRes = await fetchWithTimeout(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        const body = await loginRes.json().catch(() => ({}));
        console.error('Login failed', { status: loginRes.status, body });

        // Field-level validation errors → render inline next to the controls.
        const fields = fieldMessagesFrom(body);
        if (fields.email || fields.password) {
          setFieldErrors(fields);
          return;
        }

        throw new Error(messageForErrorStatus(loginRes.status, body));
      }

      const data = await loginRes.json();
      setAccessToken(data.accessToken);
      navigate('/');
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-slate-100 dark:bg-[#0f0f1a] flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Mesh orbs — matches AppLayout */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-indigo-300/25 dark:bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-1/4 -right-32 h-[340px] w-[340px] rounded-full bg-violet-300/20 dark:bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-sky-300/20 dark:bg-indigo-800/10 blur-3xl" />
      </div>

      {/* Brand */}
      <div className="relative mb-8 flex items-center gap-2.5">
        {/* Logo mark */}
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Ledgr</span>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-white/70 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] backdrop-blur-xl shadow-glass-lg p-8">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
          {mode === 'login' ? 'Sign in to continue to Ledgr.' : 'Start tracking your finances.'}
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className={inputCls}
              placeholder="you@example.com"
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-500 dark:text-red-400">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className={inputCls}
              placeholder="••••••••"
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            {fieldErrors.password && (
              <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-500 dark:text-red-400">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50/60 dark:bg-red-900/20 px-3 py-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-[#0f0f1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-500/20 active:scale-[0.99]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                {mode === 'login' ? 'Signing in…' : 'Creating account…'}
              </span>
            ) : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); setFieldErrors({}); }}
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setFieldErrors({}); }}
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
