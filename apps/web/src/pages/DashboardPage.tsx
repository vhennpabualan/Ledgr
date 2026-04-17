import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi, expensesApi, budgetsApi, incomeApi, categoriesApi } from '../lib/api';
import type { ReportSummary, TrendPoint, Expense, BalanceSummary, Category, Budget, BudgetStatus, Income } from '@ledgr/types';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { todayISO } from '../components/DatePicker';
import { Link } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() { return todayISO(); }
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
function monthLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
function daysInCurrentMonth(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function dayOfMonth(): number {
  return new Date().getDate();
}

// ─── Shared glass card class ──────────────────────────────────────────────────

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/[0.06] dark:bg-white/[0.06] ${className}`} />;
}

// ─── Income manager modal ─────────────────────────────────────────────────────

interface IncomeModalProps { year: number; month: number; onClose: () => void; }

function IncomeModal({ year, month, onClose }: IncomeModalProps) {
  const queryClient = useQueryClient();
  const { formatMoney } = useSettings();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dashboard-balance'] });

  const { data: entries = [], isLoading } = useQuery<Income[]>({
    queryKey: ['income-entries', year, month],
    queryFn: () => incomeApi.listEntries(year, month).then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () => incomeApi.addEntry({
      amount: Math.round(parseFloat(amount) * 100),
      year, month,
      label: label.trim() || 'Income',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-entries', year, month] });
      invalidate();
      setLabel(''); setAmount(''); setError('');
    },
    onError: () => setError('Failed to add entry.'),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => incomeApi.patchEntry(id, {
      amount: Math.round(parseFloat(editAmount) * 100),
      label: editLabel.trim() || 'Income',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-entries', year, month] });
      invalidate();
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => incomeApi.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-entries', year, month] });
      invalidate();
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) { setError('Enter a valid amount.'); return; }
    setError('');
    addMutation.mutate();
  }

  function startEdit(entry: Income) {
    setEditingId(entry.id);
    setEditLabel(entry.label);
    setEditAmount(String(entry.amount / 100));
  }

  const totalIncome = entries.reduce((s, e) => s + e.amount, 0);

  const inputCls = 'w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="income-modal-title">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/70 dark:border-white/[0.10] bg-white dark:bg-[#1a1a2e] shadow-2xl flex flex-col max-h-[85dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div>
            <h2 id="income-modal-title" className="text-base font-semibold text-gray-800 dark:text-gray-100">Income sources</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {entries.length > 0 ? `Total: ${formatMoney(totalIncome)}` : 'Add your income sources for this month'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors focus:outline-none" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Entry list */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-black/[0.05] dark:bg-white/[0.05] animate-pulse" />)}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No income entries yet.</p>
          ) : entries.map((entry) => (
            editingId === entry.id ? (
              /* Inline edit row */
              <div key={entry.id} className="flex items-center gap-2 rounded-xl border border-indigo-300/60 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-900/20 px-3 py-2">
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  maxLength={100}
                  className="flex-1 min-w-0 rounded-lg border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.08] dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Label"
                />
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-24 rounded-lg border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.08] dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={() => patchMutation.mutate({ id: entry.id })}
                  disabled={patchMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors focus:outline-none"
                >
                  {patchMutation.isPending ? '…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none focus:outline-none">×</button>
              </div>
            ) : (
              /* Display row */
              <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] px-3 py-2.5 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{entry.label}</p>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">{formatMoney(entry.amount)}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="rounded-lg p-1 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 transition-colors focus:outline-none"
                    aria-label={`Edit ${entry.label}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(entry.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg p-1 text-gray-400 hover:text-red-500 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors focus:outline-none"
                    aria-label={`Delete ${entry.label}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          ))}
        </div>

        {/* Add entry form */}
        <div className="px-6 pb-6 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Add entry</p>
          <form onSubmit={handleAdd} className="space-y-2">
            <input
              type="text"
              placeholder="Label (e.g. Salary, Freelance)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={100}
              className={inputCls}
            />
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(''); }}
                className={`${inputCls} flex-1`}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20 shrink-0"
              >
                {addMutation.isPending ? '…' : 'Add'}
              </button>
            </div>
            {error && <p role="alert" className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Balance card ─────────────────────────────────────────────────────────────

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  );
}

function BalanceCard({ balance, onEdit }: { balance: BalanceSummary; onEdit: () => void }) {
  const { income, totalIncome, entries, totalSpent, remaining, remainingAfterPending, pendingTotal, percentSpent } = balance;
  const { formatMoney } = useSettings();
  const [hidden, setHidden] = useState(false);
  const pct = Math.min(percentSpent, 100);
  const hasIncome = totalIncome > 0;
  const isOver = remaining < 0;
  const isOverAfterPending = remainingAfterPending < 0;
  const barColor = isOver ? 'bg-red-400' : percentSpent >= 80 ? 'bg-amber-400' : 'bg-emerald-400';
  const mask = '••••••';

  return (
    <div className={`${glass} p-5`}>
      {/* Hero: Remaining balance */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Remaining balance</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHidden((h) => !h)}
              className="rounded-xl p-1.5 text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none"
              aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
            >
              <EyeIcon hidden={hidden} />
            </button>
            <button
              onClick={onEdit}
              className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
            >
              {hasIncome ? `${entries.length} source${entries.length !== 1 ? 's' : ''}` : 'Add income'}
            </button>
          </div>
        </div>
        <p className={`text-4xl font-bold mt-1 ${isOver ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
          {hasIncome
            ? (hidden ? mask : (isOver ? `-${formatMoney(Math.abs(remaining))}` : formatMoney(remaining)))
            : '—'}
        </p>
        {hasIncome && !hidden && pendingTotal > 0 && (
          <p className={`text-sm mt-0.5 font-medium ${isOverAfterPending ? 'text-red-400' : 'text-amber-500'}`}>
            {isOverAfterPending ? `-${formatMoney(Math.abs(remainingAfterPending))}` : formatMoney(remainingAfterPending)} after pending
          </p>
        )}
        {hasIncome && hidden && pendingTotal > 0 && (
          <p className="text-sm mt-0.5 font-medium text-amber-500">{mask} after pending</p>
        )}
      </div>

      {hasIncome ? (
        <>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="h-2 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
              <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${hidden ? 0 : pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
              <span>{hidden ? '–' : `${percentSpent.toFixed(1)}% spent`}</span>
              <span>{hidden ? '–' : `${(100 - pct).toFixed(1)}% left`}</span>
            </div>
          </div>

          {/* Income sources breakdown (up to 3, then summarised) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                {entries.length === 1 ? (income?.label ?? 'Income') : `Income (${entries.length} sources)`}
              </p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{hidden ? mask : formatMoney(totalIncome)}</p>
            </div>
            <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Spent</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{hidden ? mask : formatMoney(totalSpent)}</p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">Add your income sources to track your monthly balance.</p>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`${glass} p-5`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-800 dark:text-gray-100 truncate">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

// ─── Recent expense row ───────────────────────────────────────────────────────

function RecentRow({ expense }: { expense: Expense }) {
  const { formatMoney } = useSettings();
  const date = new Date(expense.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{expense.description ?? 'No description'}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{date}</p>
      </div>
      <span className="ml-4 shrink-0 text-sm font-semibold text-gray-800 dark:text-gray-100">{formatMoney(expense.amount)}</span>
    </div>
  );
}

// ─── Dashboard budget row (with live progress bar + alert) ───────────────────

function DashboardBudgetRow({ budget, category }: { budget: Budget; category: Category | undefined }) {
  const { formatMoney, budgetAlertThreshold } = useSettings();
  const { data: status } = useQuery<BudgetStatus>({
    queryKey: ['budget-status', budget.id],
    queryFn: () => budgetsApi.getStatus(budget.id).then((r) => r.data),
    staleTime: 3 * 60 * 1000,
  });

  const spentPct = status ? Math.min((status.spent / budget.limitAmount) * 100, 100) : 0;
  const pendingPct = status ? Math.min((status.pending / budget.limitAmount) * 100, 100 - spentPct) : 0;
  const isOver = status?.isOverBudget ?? false;
  const isWarning = !isOver && spentPct >= budgetAlertThreshold;
  const barColor = isOver ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-indigo-500';

  return (
    <div className="py-2.5 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 space-y-1.5">
      {/* Top row: category + amounts */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          {category && (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs"
              style={{ backgroundColor: category.color + '22', color: category.color }}
              aria-hidden="true"
            >
              {category.icon}
            </span>
          )}
          <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{category?.name ?? '—'}</span>
          {isOver && <span className="shrink-0 text-[10px] font-bold text-red-500 dark:text-red-400">Over</span>}
          {isWarning && <span className="shrink-0 text-[10px]" aria-label="Budget warning">⚠️</span>}
        </div>
        <div className="shrink-0 text-right">
          {status ? (
            <span className={`text-xs font-semibold tabular-nums ${isOver ? 'text-red-500 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
              {formatMoney(status.spent)}
              <span className="font-normal text-gray-400 dark:text-gray-500"> / {formatMoney(budget.limitAmount)}</span>
            </span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">{formatMoney(budget.limitAmount)}</span>
          )}
        </div>
      </div>

      {/* Progress bar: indigo spent + amber pending */}
      {status ? (
        <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06] overflow-hidden flex">
          <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${spentPct}%` }} aria-hidden="true" />
          <div className="h-full bg-amber-300/70 transition-all duration-500" style={{ width: `${pendingPct}%` }} aria-hidden="true" />
        </div>
      ) : (
        <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
      )}
    </div>
  );
}

// ─── Spending forecast card ───────────────────────────────────────────────────

function ForecastCard({ trend, income }: { trend: TrendPoint[] | undefined; income: number | null }) {
  const { formatMoney } = useSettings();

  if (!trend || trend.length === 0) return null;

  const currentDay = dayOfMonth();
  const totalDays = daysInCurrentMonth();
  const daysLeft = totalDays - currentDay;

  // Sum only days that have data (some days may be zero / missing)
  const totalSpentSoFar = trend.reduce((sum, p) => sum + p.totalSpent, 0);
  // Average per elapsed day (use currentDay as denominator — not just days with data)
  const avgPerDay = currentDay > 0 ? totalSpentSoFar / currentDay : 0;
  const projectedTotal = totalSpentSoFar + avgPerDay * daysLeft;

  const overIncome = income !== null && projectedTotal > income;
  const projectedOverBy = income !== null ? projectedTotal - income : 0;

  // Only show if we have at least 3 days of data — earlier projections are too noisy
  if (currentDay < 3) return null;

  return (
    <div className={`${glass} p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Month-end forecast</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Based on your average of {formatMoney(Math.round(avgPerDay))}/day over {currentDay} days
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 bg-black/[0.04] dark:bg-white/[0.04] rounded-lg px-2 py-1">
          {daysLeft}d left
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-3">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Spent so far</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{formatMoney(totalSpentSoFar)}</p>
        </div>
        <div className={`rounded-xl p-3 ${overIncome ? 'bg-red-50/60 dark:bg-red-900/20' : 'bg-indigo-50/60 dark:bg-indigo-900/20'}`}>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Projected total</p>
          <p className={`text-sm font-semibold tabular-nums ${overIncome ? 'text-red-500 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
            {formatMoney(Math.round(projectedTotal))}
          </p>
        </div>
      </div>

      {/* Insight line */}
      {income !== null && (
        <p className={`mt-3 text-xs font-medium ${overIncome ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {overIncome
            ? `At this rate you'll exceed your income by ${formatMoney(Math.round(projectedOverBy))}.`
            : `You're on track to stay ${formatMoney(Math.round(income - projectedTotal))} under your income.`}
        </p>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { year, month } = currentYearMonth();
  const { formatMoney } = useSettings();
  const from = firstOfMonth();
  const to = today();
  const [showIncomeModal, setShowIncomeModal] = useState(false);

  // Track dark mode for chart tooltip styling
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const summary = useQuery<ReportSummary>({
    queryKey: ['dashboard-summary', from, to],
    queryFn: () => reportsApi.getSummary({ from, to, groupBy: 'category' }).then((r) => r.data),
  });
  const trend = useQuery<TrendPoint[]>({
    queryKey: ['dashboard-trend', from, to],
    queryFn: () => reportsApi.getTrend({ from, to, groupBy: 'day' }).then((r) => r.data),
  });
  const recent = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => expensesApi.list({ page: 1, pageSize: 5 }).then((r) => r.data),
  });
  const budgets = useQuery({
    queryKey: ['dashboard-budgets', year, month],
    queryFn: () => budgetsApi.list(year, month).then((r) => r.data),
  });
  const categories = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
  });
  const balance = useQuery<BalanceSummary>({
    queryKey: ['dashboard-balance', year, month],
    queryFn: () => incomeApi.getBalance(year, month).then((r) => r.data),
  });

  const categoryMap = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const topCategory = summary.data?.breakdown[0];
  const budgetCount = budgets.data?.length ?? 0;

  return (
    <div className="space-y-5">
      {showIncomeModal && (
        <IncomeModal year={year} month={month} onClose={() => setShowIncomeModal(false)} />
      )}

      {/* Balance card */}
      {balance.isLoading ? <Skeleton className="h-48" />
        : balance.isError ? <p className="text-sm text-red-500">Failed to load balance.</p>
        : <BalanceCard balance={balance.data!} onEdit={() => setShowIncomeModal(true)} />}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {summary.isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : summary.isError
          ? <p className="col-span-3 text-sm text-red-500">Failed to load summary.</p>
          : <>
              <StatCard label="Spent this month" value={formatMoney(summary.data!.totalSpent)} sub={`${summary.data!.breakdown.length} categories`} />
              <StatCard label="Top category" value={topCategory?.categoryName ?? '—'} sub={topCategory ? formatMoney(topCategory.totalSpent) : undefined} />
              <StatCard label="Active budgets" value={String(budgetCount)} sub={budgetCount > 0 ? 'this month' : 'none set'} />
            </>}
      </div>

      {/* Trend chart */}
      <div className={`${glass} p-5`}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Spending this month</h2>
        {trend.isLoading ? <Skeleton className="h-48" />
          : trend.isError ? <p className="text-sm text-red-500">Failed to load trend.</p>
          : trend.data!.length === 0
          ? <div className="flex h-48 items-center justify-center text-sm text-gray-400 dark:text-gray-500">No expenses recorded yet this month.</div>
          : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000008" />
                <XAxis dataKey="label" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₱${(v / 100).toFixed(0)}`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: unknown) => [formatMoney(v as number), 'Spent']}
                  labelFormatter={(label: unknown) => monthLabel(label as string)}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 12,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    background: isDark ? 'rgba(26,26,46,0.92)' : 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(8px)',
                    color: isDark ? '#e5e7eb' : '#1f2937',
                  }}
                />
                <Area type="monotone" dataKey="totalSpent" stroke="#6366f1" strokeWidth={2} fill="url(#spendGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
      </div>

      {/* Spending forecast */}
      <ForecastCard
        trend={trend.isError ? undefined : trend.data}
        income={balance.data?.totalIncome ?? null}
      />

      {/* Recent + Budgets */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={`${glass} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Recent expenses</h2>
            <Link to="/expenses" className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline">View all</Link>
          </div>
          {recent.isLoading
            ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            : recent.isError ? <p className="text-sm text-red-500 dark:text-red-400">Failed to load expenses.</p>
            : recent.data!.data.length === 0 ? <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No expenses yet.</p>
            : recent.data!.data.map((e) => <RecentRow key={e.id} expense={e} />)}
        </div>

        <div className={`${glass} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Budgets</h2>
            <Link to="/budgets" className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline">Manage</Link>
          </div>
          {budgets.isLoading
            ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            : budgets.isError ? <p className="text-sm text-red-500 dark:text-red-400">Failed to load budgets.</p>
            : budgets.data!.length === 0 ? <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No budgets set for this month.</p>
            : budgets.data!.map((b) => (
                <DashboardBudgetRow key={b.id} budget={b} category={categoryMap.get(b.categoryId)} />
              ))}
        </div>
      </div>

    </div>
  );
}
