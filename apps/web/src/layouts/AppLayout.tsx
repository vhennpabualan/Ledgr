import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { categoriesApi, expensesApi, budgetsApi, reportsApi, incomeApi } from '../lib/api';

const NAV_LINKS = [
  { to: '/',           label: 'Dashboard',  end: true  },
  { to: '/expenses',   label: 'Expenses',   end: false },
  { to: '/budgets',    label: 'Budgets',    end: false },
  { to: '/reports',    label: 'Reports',    end: false },
  { to: '/categories', label: 'Categories', end: false },
] as const;

/** Pull email from JWT payload without a library */
function getEmailFromToken(token: string | null): string {
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email ?? payload.sub ?? '';
  } catch {
    return '';
  }
}

/** "john.doe@example.com" → "JD" */
function initials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

// ─── Nav icons ────────────────────────────────────────────────────────────────

function NavIcon({ route, isActive }: { route: string; isActive: boolean }) {
  const cls = `h-5 w-5 transition-colors duration-200 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`;
  if (route === '/')
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V20a.5.5 0 00.5.5h5v-5h4v5h5a.5.5 0 00.5-.5v-9.5" />
      </svg>
    );
  if (route === '/expenses')
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-6-6h12" />
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (route === '/budgets')
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (route === '/reports')
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-4 4 4 4-6 4 2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18" />
      </svg>
    );
  if (route === '/categories')
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 12h.01M7 17h.01M11 7h6M11 12h6M11 17h6" />
      </svg>
    );
  // settings
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// ─── User menu ────────────────────────────────────────────────────────────────

function UserMenu({ onLogout }: { onLogout: () => void }) {
  const { accessToken } = useAuth();
  const email = getEmailFromToken(accessToken);
  const avatar = initials(email);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="User menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 select-none ring-1 ring-white/20"
      >
        {avatar}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1e1e35] shadow-xl shadow-black/[0.08] z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
            <p className="text-xs text-gray-400 truncate">{email || 'Signed in'}</p>
          </div>
          <Link to="/settings" onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors duration-150">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
          <div className="border-t border-black/[0.06] dark:border-white/[0.06]" />
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h7a1 1 0 100-2H4V5h6a1 1 0 100-2H3zm11.293 4.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L15.586 12H9a1 1 0 110-2h6.586l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page title map ───────────────────────────────────────────────────────────

function usePageTitle() {
  const { pathname } = useLocation();
  const map: Record<string, string> = {
    '/': 'Dashboard',
    '/expenses': 'Expenses',
    '/budgets': 'Budgets',
    '/reports': 'Reports',
    '/categories': 'Categories',
    '/settings': 'Settings',
  };
  return map[pathname] ?? 'Ledgr';
}

// ─── Prefetch on hover ────────────────────────────────────────────────────────

function usePrefetch() {
  const queryClient = useQueryClient();

  return useCallback((route: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to = now.toISOString().slice(0, 10);

    const STALE = 3 * 60 * 1000;

    switch (route) {
      case '/':
        queryClient.prefetchQuery({ queryKey: ['dashboard-balance', year, month], queryFn: () => incomeApi.getBalance(year, month).then(r => r.data), staleTime: STALE });
        queryClient.prefetchQuery({ queryKey: ['dashboard-summary', from, to], queryFn: () => reportsApi.getSummary({ from, to, groupBy: 'category' }).then(r => r.data), staleTime: STALE });
        break;
      case '/expenses':
        queryClient.prefetchQuery({ queryKey: ['expenses', { page: 1, pageSize: 20 }], queryFn: () => expensesApi.list({ page: 1, pageSize: 20 }).then(r => r.data), staleTime: STALE });
        break;
      case '/budgets':
        queryClient.prefetchQuery({ queryKey: ['budgets', year, month], queryFn: () => budgetsApi.list(year, month).then(r => r.data), staleTime: STALE });
        break;
      case '/reports':
        queryClient.prefetchQuery({ queryKey: ['report-summary', from, to, 'category'], queryFn: () => reportsApi.getSummary({ from, to, groupBy: 'category' }).then(r => r.data), staleTime: STALE });
        break;
      case '/categories':
        queryClient.prefetchQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list().then(r => r.data), staleTime: STALE });
        break;
    }
  }, [queryClient]);
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const mainRef = useRef<HTMLElement>(null);
  const pageTitle = usePageTitle();

  const prefetch = usePrefetch();

  function handleLogout() {
    setAccessToken(null);
    navigate('/login', { replace: true });
  }

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  usePullToRefresh({ onRefresh: handleRefresh, scrollRef: mainRef });

  // Scroll to top on route change
  const { pathname } = useLocation();
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-100 dark:bg-[#0f0f1a]">
      {/* Mesh orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-indigo-300/25 dark:bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-1/4 -right-32 h-[340px] w-[340px] rounded-full bg-violet-300/20 dark:bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-sky-300/20 dark:bg-indigo-800/10 blur-3xl" />
      </div>

      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="relative hidden md:flex w-56 flex-shrink-0 flex-col border-r border-black/[0.06] dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5">
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Ledgr</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV_LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onMouseEnter={() => prefetch(to)}
              className={({ isActive }) =>
                [
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/20'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-gray-800 dark:hover:text-gray-100',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <NavIcon route={to} isActive={isActive} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar bottom gradient line */}
        <div className="mx-4 mb-4 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Offline banner */}
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-amber-500/20 backdrop-blur-sm border-b border-amber-500/20 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            You're offline — showing cached data
          </div>
        )}

        {/* Top bar */}
        <header className="relative z-20 flex items-center justify-between px-4 md:px-8 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl pt-[env(safe-area-inset-top)] md:pt-0">
          <div className="flex items-center justify-between w-full py-3">
            <span className="text-base font-semibold text-gray-800 dark:text-gray-100 md:hidden">{pageTitle}</span>
            <span className="hidden md:block text-sm font-semibold text-gray-800 dark:text-gray-100">{pageTitle}</span>
            <UserMenu onLogout={handleLogout} />
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 pb-28 md:p-8 md:pb-8">
          <div className="mx-auto max-w-5xl" key={location.pathname} style={{ animation: 'pageEnter 0.22s ease both' }}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden flex items-center border-t border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[#0d0d1a]/90 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)]"
      >
        {NAV_LINKS.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} onMouseEnter={() => prefetch(to)} onTouchStart={() => prefetch(to)} className="flex-1 focus:outline-none">
            {({ isActive }) => (
              <span
                className={[
                  'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors duration-200',
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-400 dark:text-gray-500',
                ].join(' ')}
              >
                <NavIcon route={to} isActive={isActive} />
                <span>{label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
