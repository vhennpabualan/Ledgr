import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi, expensesApi, budgetsApi, incomeApi, categoriesApi, walletsApi, recurringIncomeApi } from '../lib/api';
import type { ReportSummary, TrendPoint, Expense, BalanceSummary, Category, Budget, Wallet } from '@ledgr/types';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

function currentMonthName() {
  return new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/[0.06] dark:bg-white/[0.06] ${className}`} />;
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, linkTo, linkLabel }: { title: string; linkTo: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between px-1 mb-3">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h2>
      <Link
        to={linkTo}
        className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

// ─── Recent expense row ───────────────────────────────────────────────────────

function RecentRow({ expense, categoryMap, onTap }: {
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
      className="w-full flex items-center gap-3 py-2.5 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 text-left active:bg-black/[0.03] dark:active:bg-white/[0.03] rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      {expense.description && getDomainFromLabel(expense.description)
        ? <BrandLogo label={expense.description} size={36} className="shrink-0" />
        : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-white/90 border border-black/[0.07] dark:border-white/[0.10] shadow-sm text-base" aria-hidden="true">
            {category?.icon ?? '💸'}
          </span>
      }
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
          {expense.description ?? category?.name ?? 'No description'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{category?.name ?? date}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{formatMoney(expense.amount)}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{date}</p>
      </div>
    </button>
  );
}

// ─── Wallet row ───────────────────────────────────────────────────────────────

function WalletRow({ wallet }: { wallet: Wallet }) {
  const { formatMoney } = useSettings();
  const isNeg = wallet.balance < 0;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0">
      <BrandLogo label={wallet.name} size={32} className="shrink-0" />
      <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">{wallet.name}</span>
      <span className={`text-sm font-semibold tabular-nums shrink-0 ${isNeg ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
        {isNeg ? `−${formatMoney(Math.abs(wallet.balance))}` : formatMoney(wallet.balance)}
      </span>
    </div>
  );
}

// ─── Spend chart ──────────────────────────────────────────────────────────────

function SpendChart({ data, isDark, formatMoney }: { data: TrendPoint[]; isDark: boolean; formatMoney: (n: number) => string }) {
  if (data.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No spending data yet this month.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={96}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tickFormatter={(v, i) => i % 7 === 0 ? monthLabel(v) : ''}
          tick={{ fontSize: 9, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Tooltip
          formatter={(v: unknown) => [formatMoney(v as number), 'Spent']}
          labelFormatter={(label: unknown) => monthLabel(label as string)}
          contentStyle={{
            fontSize: 11,
            borderRadius: 10,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? 'rgba(26,26,46,0.95)' : 'rgba(255,255,255,0.95)',
            color: isDark ? '#e5e7eb' : '#1f2937',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        />
        <Area type="monotone" dataKey="totalSpent" stroke="#6366f1" strokeWidth={2} fill="url(#dashGrad)" dot={false} activeDot={{ r: 3, fill: '#6366f1' }} />
      </AreaChart>
    </ResponsiveContainer>
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
  const queryClient = useQueryClient();

  // Trigger recurring income processing on every dashboard load.
  // This is the "cron" substitute — fires once per mount, silently.
  const processMutation = useMutation({
    mutationFn: () => recurringIncomeApi.process(),
    onSuccess: (res) => {
      if (res.data.created > 0) {
        // New income entries were created — refresh balance
        queryClient.invalidateQueries({ queryKey: ['dashboard-balance'] });
      }
    },
  });
  useEffect(() => {
    processMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => obs.disconnect();
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
  const BUDGET_PREVIEW = 4;
  const visibleBudgets = showAllBudgets
    ? (budgets.data ?? [])
    : (budgets.data ?? []).slice(0, BUDGET_PREVIEW);
  const hiddenBudgetCount = (budgets.data?.length ?? 0) - BUDGET_PREVIEW;

  return (
    <div className="space-y-5">
      {showIncomeModal && (
        <IncomeModal year={year} month={month} onClose={() => setShowIncomeModal(false)} />
      )}
      <BottomSheet open={!!editingExpense} onClose={() => setEditingExpense(null)} title="Edit expense">
        {editingExpense && (
          <ExpenseForm expense={editingExpense} onSuccess={() => setEditingExpense(null)} onCancel={() => setEditingExpense(null)} />
        )}
      </BottomSheet>

      {/* ── Balance card (hero) ── */}
      {balance.isLoading
        ? <Skeleton className="h-52" />
        : balance.isError
        ? <p className="text-sm text-red-500">Failed to load balance.</p>
        : <BalanceCard balance={balance.data!} onEdit={() => setShowIncomeModal(true)} />
      }

      {/* ── Spending overview: chart + top stat inline ── */}
      <div className={`${glass} p-4`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Spending</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{currentMonthName()}</p>
          </div>
          {summary.data && (
            <div className="text-right">
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {formatMoney(summary.data.totalSpent)}
              </p>
              {summary.data.breakdown[0] && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Top: {summary.data.breakdown[0].categoryName}
                </p>
              )}
            </div>
          )}
        </div>

        {trend.isLoading
          ? <Skeleton className="h-24" />
          : trend.isError
          ? null
          : <SpendChart data={trend.data!} isDark={isDark} formatMoney={formatMoney} />
        }

        {/* Category breakdown — compact pills */}
        {summary.data && summary.data.breakdown.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {summary.data.breakdown.slice(0, 5).map((b, i) => {
              const colors = ['bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
                'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
                'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'];
              return (
                <span key={b.categoryId} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${colors[i % colors.length]}`}>
                  {categoryMap.get(b.categoryId)?.icon ?? '•'} {b.categoryName}
                  <span className="opacity-60">{b.percentage.toFixed(0)}%</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Forecast ── */}
      <ForecastCard trend={trend.isError ? undefined : trend.data} income={balance.data?.totalIncome ?? null} />

      {/* ── Accounts (wallets) ── */}
      {!wallets.isLoading && !wallets.isError && (wallets.data?.length ?? 0) > 0 && (
        <div className={`${glass} p-4`}>
          <SectionHeader title="Accounts" linkTo="/wallets" linkLabel="Manage" />
          <div>
            {wallets.data!.map((w) => <WalletRow key={w.id} wallet={w} />)}
          </div>
          {wallets.data!.length > 1 && (() => {
            const total = wallets.data!.reduce((s, w) => s + w.balance, 0);
            const isNeg = total < 0;
            return (
              <div className="mt-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">Combined</span>
                <span className={`text-sm font-bold tabular-nums ${isNeg ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>
                  {isNeg ? `−${formatMoney(Math.abs(total))}` : formatMoney(total)}
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Recent expenses ── */}
      <div className={`${glass} p-4`}>
        <SectionHeader title="Recent expenses" linkTo="/expenses" linkLabel="View all" />
        {recent.isLoading
          ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          : recent.isError
          ? <p className="text-sm text-red-500 dark:text-red-400">Failed to load.</p>
          : recent.data!.data.length === 0
          ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">No expenses yet this month.</p>
            </div>
          )
          : recent.data!.data.map((e) => (
              <RecentRow key={e.id} expense={e} categoryMap={categoryMap} onTap={setEditingExpense} />
            ))
        }
      </div>

      {/* ── Budgets ── */}
      {(budgets.isLoading || (budgets.data?.length ?? 0) > 0) && (
        <div className={`${glass} p-4`}>
          <SectionHeader title="Budgets" linkTo="/budgets" linkLabel="Manage" />
          {budgets.isLoading
            ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            : budgets.isError
            ? <p className="text-sm text-red-500 dark:text-red-400">Failed to load.</p>
            : (
              <>
                {visibleBudgets.map((b) => (
                  <DashboardBudgetRow key={b.id} budget={b} category={categoryMap.get(b.categoryId)} />
                ))}
                {hiddenBudgetCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllBudgets((v) => !v)}
                    className="mt-2 w-full text-xs text-indigo-500 dark:text-indigo-400 hover:underline focus:outline-none py-1"
                  >
                    {showAllBudgets ? 'Show less' : `+${hiddenBudgetCount} more`}
                  </button>
                )}
              </>
            )
          }
        </div>
      )}
    </div>
  );
}
