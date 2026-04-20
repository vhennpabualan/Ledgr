import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { accountApi, reportsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useSettings, type ThemePreference, type Currency } from '../contexts/SettingsContext';

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';
const inputCls = 'w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors placeholder:text-gray-400';
const sectionTitle = 'text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4';

// ─── Change password ──────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => accountApi.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => { setSuccess(true); setCurrent(''); setNext(''); setConfirm(''); setError(''); },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Failed to change password.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next !== confirm) return setError('Passwords do not match.');
    mutation.mutate();
  }

  return (
    <div className={`${glass} p-5`}>
      <h2 className={sectionTitle}>Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div>
          <label htmlFor="cp-current" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Current password</label>
          <input id="cp-current" type="password" placeholder="Current password" value={current}
            onChange={(e) => setCurrent(e.target.value)} className={inputCls} autoComplete="current-password" />
        </div>
        <div>
          <label htmlFor="cp-new" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">New password</label>
          <input id="cp-new" type="password" placeholder="Min 8 characters" value={next}
            onChange={(e) => setNext(e.target.value)} className={inputCls} autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="cp-confirm" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Confirm new password</label>
          <input id="cp-confirm" type="password" placeholder="Confirm new password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} className={inputCls} autoComplete="new-password" />
        </div>
        {error && <p className="text-xs text-red-500 dark:text-red-400" role="alert">{error}</p>}
        {success && <p className="text-xs text-emerald-600 dark:text-emerald-400" role="status">Password changed successfully.</p>}
        <button type="submit" disabled={mutation.isPending || !current || !next || !confirm}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20">
          {mutation.isPending ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

// ─── Preferences ──────────────────────────────────────────────────────────────

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'PHP', label: '₱ Philippine Peso' },
  { value: 'USD', label: '$ US Dollar' },
  { value: 'EUR', label: '€ Euro' },
  { value: 'GBP', label: '£ British Pound' },
  { value: 'JPY', label: '¥ Japanese Yen' },
  { value: 'SGD', label: 'S$ Singapore Dollar' },
];

const THEMES: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: '💻' },
  { value: 'light',  label: 'Light',  icon: '☀️' },
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
];

function PreferencesSection() {
  const { theme, currency, setTheme, setCurrency, formatMoney } = useSettings();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  // Recalculate position whenever it opens or on scroll/resize
  useEffect(() => {
    if (!currencyOpen || !triggerRef.current) return;
    const update = () => {
      setDropdownRect(triggerRef.current!.getBoundingClientRect());
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [currencyOpen]);

  // Close on outside click — ref-based, no stopPropagation
  useEffect(() => {
    if (!currencyOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setCurrencyOpen(false);
    }
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [currencyOpen]);

  // Close on Escape
  useEffect(() => {
    if (!currencyOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setCurrencyOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [currencyOpen]);

  const selectedCurrency = CURRENCIES.find((c) => c.value === currency);

  return (
    <div className={`${glass} p-5 space-y-5`}>
      <h2 className={sectionTitle}>Preferences</h2>

      {/* Theme */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Theme</p>
        <div className="flex gap-2 flex-wrap">
          {THEMES.map((t) => (
            <button key={t.value} type="button" onClick={() => setTheme(t.value)}
              className={[
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none',
                theme === t.value
                  ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/20'
                  : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
              ].join(' ')}
              aria-pressed={theme === t.value}>
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Currency */}
      <div>
        <label htmlFor="currency-trigger" className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
          Currency
        </label>
        <div className="max-w-xs">
          <button
            id="currency-trigger"
            ref={triggerRef}
            type="button"
            onClick={() => setCurrencyOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={currencyOpen}
            className="w-full flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
          >
            <span>{selectedCurrency?.label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${currencyOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Portaled dropdown — escapes stacking context of backdrop-blur cards */}
        {currencyOpen && dropdownRect && createPortal(
          <ul
            ref={dropdownRef}
            role="listbox"
            aria-label="Currency"
            style={{
              position: 'fixed',
              top: dropdownRect.bottom + 4,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999,
            }}
            className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1a1a2e] shadow-xl overflow-hidden py-1"
          >
            {CURRENCIES.map((c) => (
              <li
                key={c.value}
                role="option"
                aria-selected={currency === c.value}
                onClick={() => { setCurrency(c.value); setCurrencyOpen(false); }}
                className={`px-3 py-2.5 text-sm cursor-pointer select-none transition-colors ${
                  currency === c.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                }`}
              >
                {c.label}
              </li>
            ))}
          </ul>,
          document.body
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
          Preview: {formatMoney(125000)} · {formatMoney(9999)}
        </p>
      </div>
    </div>
  );
}

// ─── Budget alerts ────────────────────────────────────────────────────────────

const THRESHOLDS = [50, 60, 70, 75, 80, 90, 95];

function BudgetAlertsSection() {
  const { budgetAlertThreshold, setBudgetAlertThreshold } = useSettings();

  return (
    <div className={`${glass} p-5`}>
      <h2 className={sectionTitle}>Budget Alerts</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Show a warning when spending reaches this percentage of a budget limit.
      </p>
      <div className="flex flex-wrap gap-2">
        {THRESHOLDS.map((t) => (
          <button key={t} type="button" onClick={() => setBudgetAlertThreshold(t)}
            className={[
              'rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-150 focus:outline-none',
              budgetAlertThreshold === t
                ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/20'
                : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
            ].join(' ')}
            aria-pressed={budgetAlertThreshold === t}>
            {t}%
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

function DataSection() {
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleExport() {
    setExportLoading(true); setExportError('');
    try {
      const now = new Date();
      const from = `${now.getFullYear() - 1}-01-01`;
      const to = now.toISOString().slice(0, 10);
      const res = await reportsApi.exportCSV({ from, to });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ledgr-export.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div className={`${glass} p-5`}>
      <h2 className={sectionTitle}>Data</h2>
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Export all data</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Downloads all your expenses as a CSV file.</p>
          <button type="button" onClick={handleExport} disabled={exportLoading}
            className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-50 transition-colors focus:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            {exportLoading ? 'Exporting…' : 'Export CSV'}
          </button>
          {exportError && <p className="text-xs text-red-500 mt-1">{exportError}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

function DangerZoneSection() {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => accountApi.deleteAccount({ password }),
    onSuccess: () => {
      queryClient.clear();
      setAccessToken(null);
      navigate('/login', { replace: true });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Failed to delete account.'),
  });

  return (
    <div className="rounded-2xl border border-red-200/60 dark:border-red-500/20 bg-red-50/40 dark:bg-red-900/10 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-red-500 dark:text-red-400 mb-4">Danger Zone</h2>

      {!showConfirm ? (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <button type="button" onClick={() => setShowConfirm(true)}
            className="rounded-xl border border-red-300/60 dark:border-red-500/30 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors focus:outline-none">
            Delete my account
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-w-sm">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Enter your password to confirm deletion.
          </p>
          <input type="password" placeholder="Your password" value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            className={inputCls} autoFocus />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowConfirm(false); setPassword(''); setError(''); }}
              className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none">
              Cancel
            </button>
            <button type="button" onClick={() => mutation.mutate()} disabled={!password || mutation.isPending}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 transition-colors focus:outline-none">
              {mutation.isPending ? 'Deleting…' : 'Permanently delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { accessToken } = useAuth();
  let email = '';
  try {
    const payload = JSON.parse(atob(accessToken!.split('.')[1]));
    email = payload.email ?? payload.sub ?? '';
  } catch { /* ignore */ }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Account info */}
      <div className={`${glass} p-5`}>
        <h2 className={sectionTitle}>Account</h2>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white select-none">
            {email[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{email}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Signed in</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">Version</span>
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">v{__APP_VERSION__}</span>
        </div>
      </div>
      <ChangePasswordSection />
      <PreferencesSection />
      <BudgetAlertsSection />
      <DataSection />
      <DangerZoneSection />
    </div>
  );
}
