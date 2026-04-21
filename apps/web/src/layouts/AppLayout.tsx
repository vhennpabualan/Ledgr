import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { categoriesApi, expensesApi, budgetsApi, reportsApi, incomeApi, recurringApi, walletsApi } from '../lib/api';
import BottomSheet from '../components/BottomSheet';
import ExpenseForm from '../components/ExpenseForm';

const DESKTOP_NAV = [
  { to: '/',                label: 'Dashboard',        end: true  },
  { to: '/expenses',        label: 'Expenses',         end: false },
  { to: '/budgets',         label: 'Budgets',          end: false },
  { to: '/recurring',       label: 'Recurring',        end: false },
  { to: '/recurring-income',label: 'Recurring Income', end: false },
  { to: '/reports',         label: 'Reports',          end: false },
  { to: '/categories',      label: 'Categories',       end: false },
  { to: '/wallets',         label: 'Accounts',         end: false },
] as const;

const MOBILE_NAV_LEFT = [
  { to: '/',        label: 'Home',     end: true  },
  { to: '/wallets', label: 'Accounts', end: false },
] as const;
const MOBILE_NAV_RIGHT = [
  { to: '/recurring', label: 'Recurring', end: false },
] as const;
const MOBILE_MORE_ITEMS = [
  { to: '/expenses',         label: 'Expenses' },
  { to: '/budgets',          label: 'Budgets' },
  { to: '/reports',          label: 'Reports' },
  { to: '/categories',       label: 'Categories' },
  { to: '/recurring-income', label: 'Recurring Income' },
] as const;

function getEmailFromToken(token: string | null): string {
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email ?? payload.sub ?? '';
  } catch { return ''; }
}

function initials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

// ─── Nav icons ────────────────────────────────────────────────────────────────

function NavIcon({ route, isActive }: { route: string; isActive: boolean }) {
  const cls = `h-5 w-5 transition-colors duration-200 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`;
  if (route === '/') return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V20a.5.5 0 00.5.5h5v-5h4v5h5a.5.5 0 00.5-.5v-9.5" /></svg>;
  if (route === '/expenses') return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-6-6h12" /><circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (route === '/budgets') return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  if (route === '/reports') return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-4 4 4 4-6 4 2M3 20h18" /></svg>;
  if (route === '/categories') return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 12h.01M7 17h.01M11 7h6M11 12h6M11 17h6" /></svg>;
  if (route === '/recurring') return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
  if (route === '/recurring-income') return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
  if (route === '/wallets') return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
  return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
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
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} aria-label="User menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 select-none ring-1 ring-white/20">
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
          <button type="button" onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150">
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

// ─── Hooks ────────────────────────────────────────────────────────────────────

function usePageTitle() {
  const { pathname } = useLocation();
  const map: Record<string, string> = {
    '/': 'Dashboard', '/expenses': 'Expenses', '/budgets': 'Budgets',
    '/recurring': 'Recurring', '/recurring-income': 'Recurring Income',
    '/reports': 'Reports', '/categories': 'Categories',
    '/settings': 'Settings', '/wallets': 'Accounts',
  };
  return map[pathname] ?? 'Ledgr';
}

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
      case '/recurring':
        queryClient.prefetchQuery({ queryKey: ['recurring'], queryFn: () => recurringApi.list().then(r => r.data), staleTime: STALE });
        break;
      case '/wallets':
        queryClient.prefetchQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list().then(r => r.data), staleTime: STALE });
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
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const prefetch = usePrefetch();

  function handleLogout() {
    setAccessToken(null);
    navigate('/login', { replace: true });
  }

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  usePullToRefresh({ onRefresh: handleRefresh, scrollRef: mainRef });

  const { pathname } = useLocation();
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-100 dark:bg-[#0f0f1a]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-gray-900 focus:shadow-lg">
        Skip to main content
      </a>

      {/* Mesh orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-indigo-300/25 dark:bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-1/4 -right-32 h-[340px] w-[340px] rounded-full bg-violet-300/20 dark:bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-sky-300/20 dark:bg-indigo-800/10 blur-3xl" />
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className={['relative hidden md:flex flex-shrink-0 flex-col', 'border-r border-black/[0.06] dark:border-white/[0.06]', 'bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl', 'transition-all duration-300 ease-in-out overflow-hidden', sidebarOpen ? 'w-56' : 'w-[60px]'].join(' ')}>
        {/* Logo + toggle */}
        <div className={`flex items-center px-3 py-4 ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5 pl-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 shadow-sm shadow-indigo-500/30 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-base font-bold tracking-tight text-gray-900 dark:text-white">Ledgr</span>
            </div>
          )}
          <button type="button" onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-2 py-1" aria-label="Main navigation">
          {DESKTOP_NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} onMouseEnter={() => prefetch(to)}
              title={!sidebarOpen ? label : undefined}
              className={({ isActive }) => ['group flex items-center rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200', sidebarOpen ? 'gap-3' : 'justify-center', isActive ? 'bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/20' : 'text-gray-500 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-gray-800 dark:hover:text-gray-100'].join(' ')}>
              {({ isActive }) => (
                <>
                  <NavIcon route={to} isActive={isActive} />
                  {sidebarOpen && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mx-3 mb-4 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-amber-500/20 backdrop-blur-sm border-b border-amber-500/20 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            You're offline — showing cached data
          </div>
        )}

        <header className="relative z-20 flex items-center justify-between px-4 md:px-6 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl pt-[env(safe-area-inset-top)] md:pt-0">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-base font-bold tracking-tight text-gray-900 dark:text-white">Ledgr</span>
            </div>
            <span className="hidden md:block text-sm font-semibold text-gray-800 dark:text-gray-100">{pageTitle}</span>
            <UserMenu onLogout={handleLogout} />
          </div>
        </header>

        <main id="main-content" ref={mainRef} className="flex-1 overflow-y-auto p-4 pb-32 md:p-8 md:pb-8">
          <div className="mx-auto max-w-5xl" key={pathname} style={{ animation: 'pageEnter 0.22s ease both' }}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden flex justify-center" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <nav aria-label="Main navigation" className="flex items-center mx-4 w-full max-w-sm rounded-2xl border border-black/[0.07] dark:border-white/[0.08] bg-white/90 dark:bg-[#0d0d1a]/95 backdrop-blur-2xl shadow-xl shadow-black/[0.12] px-2">
          {MOBILE_NAV_LEFT.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} onTouchStart={() => prefetch(to)} className="flex-1 focus:outline-none">
              {({ isActive }) => (
                <span className={['flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-medium transition-colors duration-200', isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'].join(' ')}>
                  <NavIcon route={to} isActive={isActive} />
                  <span>{label}</span>
                </span>
              )}
            </NavLink>
          ))}

          <div className="flex-1 flex justify-center items-center py-1.5">
            <button type="button" onClick={() => setShowQuickAdd(true)} aria-label="Add expense"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 hover:bg-indigo-500 active:scale-95 transition-all duration-150 focus:outline-none -translate-y-4 border-4 border-white dark:border-[#0d0d1a]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {MOBILE_NAV_RIGHT.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} onTouchStart={() => prefetch(to)} className="flex-1 focus:outline-none">
              {({ isActive }) => (
                <span className={['flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-medium transition-colors duration-200', isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'].join(' ')}>
                  <NavIcon route={to} isActive={isActive} />
                  <span>{label}</span>
                </span>
              )}
            </NavLink>
          ))}

          <button type="button" onClick={() => setShowMoreMenu(true)} className="flex-1 focus:outline-none" aria-label="More options">
            <span className={['flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-medium transition-colors duration-200', MOBILE_MORE_ITEMS.some(item => pathname === item.to) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'].join(' ')}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
              <span>More</span>
            </span>
          </button>
        </nav>
      </div>

      <BottomSheet open={showMoreMenu} onClose={() => setShowMoreMenu(false)} title="More">
        <div className="space-y-1">
          {MOBILE_MORE_ITEMS.map(({ to, label }) => (
            <Link key={to} to={to} onClick={() => setShowMoreMenu(false)}
              className={['flex items-center gap-4 px-4 py-4 rounded-xl text-base font-medium transition-colors duration-150', pathname === to ? 'bg-indigo-600/10 text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200 active:bg-black/[0.04] dark:active:bg-white/[0.04]'].join(' ')}>
              <NavIcon route={to} isActive={pathname === to} />
              {label}
            </Link>
          ))}
        </div>
      </BottomSheet>

      {/* Desktop FAB */}
      <button type="button" onClick={() => setShowQuickAdd(true)} aria-label="Add expense"
        className="fixed z-40 hidden md:flex items-center gap-2 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 px-4 py-3 hover:bg-indigo-500 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 bottom-8 right-8 text-sm font-semibold">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add expense
      </button>

      <BottomSheet open={showQuickAdd} onClose={() => setShowQuickAdd(false)} title="Add expense">
        <ExpenseForm onSuccess={() => setShowQuickAdd(false)} onCancel={() => setShowQuickAdd(false)} />
      </BottomSheet>
    </div>
  );
}
