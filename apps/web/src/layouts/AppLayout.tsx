import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_LINKS = [
  { to: '/',           label: 'Dashboard',  icon: '🏠', end: true  },
  { to: '/expenses',   label: 'Expenses',   icon: '💸', end: false },
  { to: '/budgets',    label: 'Budgets',    icon: '📊', end: false },
  { to: '/reports',    label: 'Reports',    icon: '📈', end: false },
  { to: '/categories', label: 'Categories', icon: '🏷️', end: false },
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
        className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors select-none"
      >
        {avatar}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
          {/* Email */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 truncate">{email || 'Signed in'}</p>
          </div>
          {/* Sign out */}
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
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

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    setAccessToken(null);
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-100">

      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-[#1a1a2e] text-gray-300">
        <div className="px-6 py-5 text-xl font-bold tracking-tight text-white">
          Ledgr
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV_LINKS.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'hover:bg-white/5 hover:text-white text-gray-300',
                ].join(' ')
              }
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Top bar — user menu always visible top-right */}
        <header className="flex items-center justify-between px-4 py-3 md:px-8 bg-white border-b border-gray-200">
          {/* App name on mobile (no sidebar visible) */}
          <span className="text-base font-bold tracking-tight text-gray-900 md:hidden">Ledgr</span>
          {/* Spacer on desktop so avatar stays right */}
          <span className="hidden md:block" />
          <UserMenu onLogout={handleLogout} />
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav bar ────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[#1a1a2e] border-t border-white/10 flex items-stretch"
      >
        {NAV_LINKS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-lg text-base transition-colors',
                    isActive ? 'bg-white/15' : '',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {icon}
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

    </div>
  );
}
