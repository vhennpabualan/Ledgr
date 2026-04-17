import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi, expensesApi, budgetsApi, incomeApi, categoriesApi, pendingItemsApi } from '../lib/api';
import type { ReportSummary, TrendPoint, Expense, BalanceSummary, Category, PendingItem } from '@ledgr/types';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { todayISO } from '../components/DatePicker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPHP(minor: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'symbol' }).format(minor / 100);
}
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

// ─── Shared glass card class ──────────────────────────────────────────────────

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/[0.06] dark:bg-white/[0.06] ${className}`} />;
}

// ─── Income modal ─────────────────────────────────────────────────────────────

interface IncomeModalProps { year: number; month: number; current?: number; onClose: () => void; }

function IncomeModal({ year, month, current, onClose }: IncomeModalProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(current ? String(current / 100) : '');
  const [label, setLabel] = useState('Salary');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => incomeApi.upsert({ amount: Math.round(parseFloat(value) * 100), year, month, label }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dashboard-balance'] }); onClose(); },
    onError: () => setError('Failed to save income.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(value);
    if (!value || isNaN(num) || num <= 0) { setError('Enter a valid amount.'); return; }
    setError('');
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4" role="dialog" aria-modal="true">
      <div className={`w-full max-w-sm rounded-2xl border border-white/70 dark:border-white/[0.10] bg-white dark:bg-[#1a1a2e] shadow-xl p-6 max-h-[90dvh] overflow-y-auto`}>
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">Set monthly income</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Label</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount (₱)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0.00"
              value={value} onChange={(e) => { setValue(e.target.value); setError(''); }}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" autoFocus />
          </div>
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Balance card ─────────────────────────────────────────────────────────────

function BalanceCard({ balance, onEdit }: { balance: BalanceSummary; onEdit: () => void }) {
  const { income, totalSpent, remaining, remainingAfterPending, pendingTotal, percentSpent } = balance;
  const pct = Math.min(percentSpent, 100);
  const isOver = remaining < 0;
  const isOverAfterPending = remainingAfterPending < 0;
  const barColor = isOver ? 'bg-red-400' : percentSpent >= 80 ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <div className={`${glass} p-5`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{income?.label ?? 'Monthly Income'}</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-0.5">{income ? formatPHP(income.amount) : '—'}</p>
        </div>
        <button onClick={onEdit}
          className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
          {income ? 'Edit' : 'Set income'}
        </button>
      </div>

      {income ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Spent</p>
              <p className="text-base font-bold text-gray-800 dark:text-gray-100">{formatPHP(totalSpent)}</p>
            </div>
            <div className={`rounded-xl p-3 ${isOver ? 'bg-red-50/80 dark:bg-red-900/20' : 'bg-emerald-50/80 dark:bg-emerald-900/20'}`}>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Remaining</p>
              <p className={`text-base font-bold ${isOver ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {isOver ? `-${formatPHP(Math.abs(remaining))}` : formatPHP(remaining)}
              </p>
            </div>
          </div>

          {pendingTotal > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2 mb-4">
              <div>
                <p className="text-xs text-amber-700 font-medium">After pending expenses</p>
                <p className="text-xs text-amber-500">-{formatPHP(pendingTotal)} reserved</p>
              </div>
              <p className={`text-base font-bold tabular-nums ${isOverAfterPending ? 'text-red-500 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isOverAfterPending ? `-${formatPHP(Math.abs(remainingAfterPending))}` : formatPHP(remainingAfterPending)}
              </p>
            </div>
          )}

          <div>
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
              <span>{percentSpent.toFixed(1)}% spent</span>
              <span>{(100 - pct).toFixed(1)}% left</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">Set your income to track your monthly balance.</p>
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
  const date = new Date(expense.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{expense.description ?? 'No description'}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{date}</p>
      </div>
      <span className="ml-4 shrink-0 text-sm font-semibold text-gray-800 dark:text-gray-100">{formatPHP(expense.amount)}</span>
    </div>
  );
}

// ─── Pending items card ───────────────────────────────────────────────────────

function PendingItemsCard({ year, month, categories }: { year: number; month: number; categories: Category[] }) {
  const queryClient = useQueryClient();
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<PendingItem[]>({
    queryKey: ['pending-items', year, month],
    queryFn: () => pendingItemsApi.list(year, month).then((r) => r.data),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pending-items', year, month] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-balance', year, month] });
  };

  const addMutation = useMutation({
    mutationFn: () => pendingItemsApi.create({ label: label.trim(), amount: Math.round(parseFloat(amount) * 100), currency: 'PHP', categoryId: categoryId || undefined, year, month }),
    onSuccess: () => { setLabel(''); setAmount(''); setCategoryId(''); setFormError(null); invalidate(); },
    onError: () => setFormError('Failed to add item.'),
  });

  const deleteMutation = useMutation({ mutationFn: (id: string) => pendingItemsApi.delete(id), onSuccess: invalidate });

  const deliverMutation = useMutation({
    mutationFn: (id: string) => pendingItemsApi.deliver(id),
    onSuccess: () => { setDeliveringId(null); invalidate(); queryClient.invalidateQueries({ queryKey: ['expenses'] }); },
    onError: () => setDeliveringId(null),
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setFormError('Label is required.');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return setFormError('Enter a valid amount.');
    addMutation.mutate();
  }

  const totalPending = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className={`${glass} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Upcoming expenses</h2>
          {items.length > 0 && <p className="text-xs text-amber-500 font-medium mt-0.5">{formatPHP(totalPending)} pending</p>}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 mb-3">{[1,2].map((i) => <div key={i} className="h-8 rounded-xl bg-black/[0.05] dark:bg-white/[0.05] animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">No upcoming expenses. Add one below.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {items.map((item) => {
            const cat = item.categoryId ? categoryMap.get(item.categoryId) : null;
            const isDelivering = deliveringId === item.id && deliverMutation.isPending;
            return (
              <li key={item.id} className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2">
                {cat && <span className="text-base shrink-0" aria-hidden="true">{cat.icon}</span>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{item.label}</p>
                  {cat && <p className="text-xs text-gray-400 dark:text-gray-500">{cat.name}</p>}
                </div>
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums shrink-0">-{formatPHP(item.amount)}</span>
                <button type="button" disabled={isDelivering || deliverMutation.isPending}
                  onClick={() => { setDeliveringId(item.id); deliverMutation.mutate(item.id); }}
                  className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors focus:outline-none">
                  {isDelivering ? '…' : '✓ Delivered'}
                </button>
                <button type="button" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending}
                  className="shrink-0 text-gray-300 hover:text-red-400 transition-colors focus:outline-none text-lg leading-none" aria-label={`Remove ${item.label}`}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleAdd} className="space-y-2">
        <input type="text" placeholder="Label (e.g. Shopee parcel)" value={label} maxLength={100}
          onChange={(e) => { setLabel(e.target.value); setFormError(null); }}
          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <div className="flex gap-2">
          <input type="number" placeholder="Amount" value={amount} min="0.01" step="0.01"
            onChange={(e) => { setAmount(e.target.value); setFormError(null); }}
            className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <div className="relative flex-1">
            <button type="button" onClick={() => setCatOpen((o) => !o)}
              className="w-full flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-amber-400">
              <span className={categoryId ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                {categoryId ? `${categoryMap.get(categoryId)?.icon} ${categoryMap.get(categoryId)?.name}` : 'Category'}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-gray-400 transition-transform ${catOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {catOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCatOpen(false)} aria-hidden="true" />
                <ul className="absolute z-20 bottom-full mb-1 w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/90 dark:bg-[#1a1a2e]/90 backdrop-blur-md shadow-lg max-h-40 overflow-y-auto py-1">
                  <li onClick={() => { setCategoryId(''); setCatOpen(false); }} className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.04]">None</li>
                  {categories.filter((c) => !c.isArchived).map((c) => (
                    <li key={c.id} onClick={() => { setCategoryId(c.id); setCatOpen(false); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${categoryId === c.id ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'}`}>
                      <span aria-hidden="true">{c.icon}</span>{c.name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        {formError && <p className="text-xs text-red-500 dark:text-red-400">{formError}</p>}
        <button type="submit" disabled={addMutation.isPending}
          className="w-full rounded-xl bg-amber-500 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400">
          {addMutation.isPending ? 'Adding…' : '+ Add upcoming expense'}
        </button>
      </form>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { year, month } = currentYearMonth();
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
        <IncomeModal year={year} month={month} current={balance.data?.income?.amount} onClose={() => setShowIncomeModal(false)} />
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
              <StatCard label="Spent this month" value={formatPHP(summary.data!.totalSpent)} sub={`${summary.data!.breakdown.length} categories`} />
              <StatCard label="Top category" value={topCategory?.categoryName ?? '—'} sub={topCategory ? formatPHP(topCategory.totalSpent) : undefined} />
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
                  formatter={(v: unknown) => [formatPHP(v as number), 'Spent']}
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

      {/* Recent + Budgets */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={`${glass} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Recent expenses</h2>
            <a href="/expenses" className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline">View all</a>
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
            <a href="/budgets" className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline">Manage</a>
          </div>
          {budgets.isLoading
            ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            : budgets.isError ? <p className="text-sm text-red-500 dark:text-red-400">Failed to load budgets.</p>
            : budgets.data!.length === 0 ? <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No budgets set for this month.</p>
            : budgets.data!.map((b) => {
                const cat = categoryMap.get(b.categoryId);
                return (
                  <div key={b.id} className="flex items-center justify-between py-2.5 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {cat && (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm"
                          style={{ backgroundColor: cat.color + '22', color: cat.color }} aria-hidden="true">
                          {cat.icon}
                        </span>
                      )}
                      <span className="text-gray-700 dark:text-gray-200 font-medium truncate">{cat?.name ?? b.categoryId}</span>
                    </div>
                    <span className="shrink-0 text-gray-500 dark:text-gray-400 tabular-nums">{formatPHP(b.limitAmount)}</span>
                  </div>
                );
              })}
        </div>
      </div>

      {/* Upcoming / pending */}
      <PendingItemsCard year={year} month={month} categories={categories.data ?? []} />
    </div>
  );
}
