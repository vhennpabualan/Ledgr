import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, expensesApi, budgetsApi, incomeApi, categoriesApi, walletsApi } from '../lib/api';
import type { ReportSummary, TrendPoint, Expense, BalanceSummary, Category, Budget, Wallet } from '@ledgr/types';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { IncomeModal, BalanceCard, ForecastCard, DashboardBudgetRow } from '../components/dashboard';
import { BrandLogo, getDomainFromLabel } from '../components/BrandLogo';
import BottomSheet from '../components/BottomSheet';
import ExpenseForm from '../components/ExpenseForm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`${glass} p-4 shrink-0 w-40 md:w-auto`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-800 dark:text-gray-100 truncate">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate">{sub}</p>}
    </div>
  );
}

// ─── Recent expense row ───────────────────────────────────────────────────────

function RecentRow({
  expense,
  categoryMap,
  onTap,
}: {
  expense: Expense;
  categoryMap: Map<string, Category>;
  onTap: (e: Expense) => void;
}) {
  const { formatMoney } = useSettings();
  const category = categoryMap.get(expense.categoryId);
  const date = new Date(expense.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  return (
    <button
      type="button"
      onClick={() => onTap(expense)}
      className="item-enter w-full flex items-center gap-3 py-2.5 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 text-left active:bg-black/[0.03] dark:active:bg-white/[0.03] rounded-xl transition-colors focus:outline-none"
    >
      {expense.description && getDomainFromLabel(expense.description)
        ? <BrandLogo label={expense.description} size={32} className="shrink-0" />
        : <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-white/90 border border-black/[0.07] dark:border-white/[0.10] shadow-sm shadow-black/[0.04] text-base"
            aria-hidden="true"
          >
            {category?.icon ?? '💸'}
          </span>
      }
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
          {expense.description ?? category?.name ?? 'No description'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{date}</p>
      </div>
      <span className="ml-2 shrink-0 text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
        {formatMoney(expense.amount)}
      </span>
    </button>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { year, month } = currentYearMonth();
  const { formatMoney } = useSettings();
  const from = firstOfMonth();
  const to = new Date().toISOString().slice(0, 10);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showAllBudgets, setShowAllBudgets] = useState(false);

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
  const budgets = useQuery<Budget[]>({
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
  const wallets = useQuery<Wallet[]>({
    queryKey: ['wallets'],
    queryFn: () => walletsApi.list().then((r) => r.data),
  });

  const categoryMap = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const topCategory = summary.data?.breakdown[0];
  const budgetCount = budgets.data?.length ?? 0;
  const BUDGET_PREVIEW = 3;
  const visibleBudgets = showAllBudgets
    ? (budgets.data ?? [])
    : (budgets.data ?? []).slice(0, BUDGET_PREVIEW);

  return (
    <div className="space-y-4">
      {showIncomeModal && (
        <IncomeModal year={year} month={month} onClose={() => setShowIncomeModal(false)} />
      )}

      {/* Edit expense sheet — opened by tapping a recent row */}
      <BottomSheet
        open={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        title="Edit expense"
      >
        {editingExpense && (
          <ExpenseForm
            expense={editingExpense}
            onSuccess={() => setEditingExpense(null)}
            onCancel={() => setEditingExpense(null)}
          />
        )}
      </BottomSheet>

      {/* Balance card */}
      {balance.isLoading ? <Skeleton className="h-44" />
        : balance.isError ? <p className="text-sm text-red-500">Failed to load balance.</p>
        : <BalanceCard balance={balance.data!} onEdit={() => setShowIncomeModal(true)} />}

      {/* Wallets widget */}
      {!wallets.isLoading && !wallets.isError && (wallets.data?.length ?? 0) > 0 && (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Accounts</h2>
            <Link to="/wallets" className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline">Manage</Link>
          </div>
          <div className="space-y-2">
            {wallets.data!.map((w) => {
              const isNeg = w.balance < 0;
              return (
                <div key={w.id} className="flex items-center gap-3">
                  <BrandLogo label={w.name} size={26} className="shrink-0" />
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">{w.name}</span>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${isNeg ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
                    {isNeg ? `-${formatMoney(Math.abs(w.balance))}` : formatMoney(w.balance)}
                  </span>
                </div>
              );
            })}
          </div>
          {wallets.data!.length > 1 && (() => {
            const total = wallets.data!.reduce((s, w) => s + w.balance, 0);
            const isNeg = total < 0;
            return (
              <div className="mt-2.5 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">Total</span>
                <span className={`text-sm font-bold tabular-nums ${isNeg ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>
                  {isNeg ? `-${formatMoney(Math.abs(total))}` : formatMoney(total)}
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Stat cards — horizontal scroll strip on mobile, 3-col grid on desktop */}
      {summary.isLoading
        ? <div className="flex gap-3 overflow-hidden"><Skeleton className="h-20 w-40 shrink-0" /><Skeleton className="h-20 w-40 shrink-0" /><Skeleton className="h-20 w-40 shrink-0" /></div>
        : summary.isError ? null
        : (
          <div className="-mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible scrollbar-none">
              <StatCard label="Spent this month" value={formatMoney(summary.data!.totalSpent)} sub={`${summary.data!.breakdown.length} categories`} />
              <StatCard label="Top category" value={topCategory?.categoryName ?? '—'} sub={topCategory ? formatMoney(topCategory.totalSpent) : undefined} />
              <StatCard label="Active budgets" value={String(budgetCount)} sub={budgetCount > 0 ? 'this month' : 'none set'} />
            </div>
          </div>
        )}

      {/* Trend chart — shorter on mobile */}
      <div className={`${glass} p-4`}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Spending this month</h2>
        {trend.isLoading ? <Skeleton className="h-36" />
          : trend.isError ? <p className="text-sm text-red-500">Failed to load trend.</p>
          : trend.data!.length === 0
          ? <div className="flex h-36 items-center justify-center text-sm text-gray-400 dark:text-gray-500">No expenses yet this month.</div>
          : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={trend.data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000008" />
                {/* Only show every 5th label on mobile to avoid overlap */}
                <XAxis
                  dataKey="label"
                  tickFormatter={(v, i) => i % 5 === 0 ? monthLabel(v) : ''}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis hide />
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

      {/* Recent expenses — tappable rows */}
      <div className={`${glass} p-4`}>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Recent expenses</h2>
          <Link to="/expenses" className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline">View all</Link>
        </div>
        {recent.isLoading
          ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          : recent.isError
          ? <p className="text-sm text-red-500 dark:text-red-400">Failed to load expenses.</p>
          : recent.data!.data.length === 0
          ? <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No expenses yet.</p>
          : recent.data!.data.map((e) => (
              <RecentRow
                key={e.id}
                expense={e}
                categoryMap={categoryMap}
                onTap={setEditingExpense}
              />
            ))}
      </div>

      {/* Budgets — capped at 3 with expand toggle */}
      <div className={`${glass} p-4`}>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Budgets</h2>
          <Link to="/budgets" className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline">Manage</Link>
        </div>
        {budgets.isLoading
          ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          : budgets.isError
          ? <p className="text-sm text-red-500 dark:text-red-400">Failed to load budgets.</p>
          : budgets.data!.length === 0
          ? <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No budgets set for this month.</p>
          : (
            <>
              {visibleBudgets.map((b) => (
                <DashboardBudgetRow key={b.id} budget={b} category={categoryMap.get(b.categoryId)} />
              ))}
              {budgetCount > BUDGET_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllBudgets((v) => !v)}
                  className="mt-2 w-full text-xs text-indigo-500 dark:text-indigo-400 hover:underline focus:outline-none py-1"
                >
                  {showAllBudgets ? 'Show less' : `Show ${budgetCount - BUDGET_PREVIEW} more`}
                </button>
              )}
            </>
          )}
      </div>

    </div>
  );
}
