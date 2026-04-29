import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
  Type as ListType,
} from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';
import { expensesApi, categoriesApi, walletsApi, incomeApi } from '../lib/api';
import type { Expense, Category, PaginatedResult, Wallet, Income } from '@ledgr/types';
import ExpenseForm from '../components/ExpenseForm';
import DatePicker from '../components/DatePicker';
import BottomSheet from '../components/BottomSheet';
import { useSettings } from '../contexts/SettingsContext';
import { BrandLogo, getDomainFromLabel } from '../components/BrandLogo';
import { useAnimatedDelete } from '../hooks/useAnimatedDelete';

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Returns "Today", "Yesterday", or a formatted date string */
function dateGroupLabel(iso: string): string {
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  if (iso === todayStr) return 'Today';
  if (iso === yesterdayStr) return 'Yesterday';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Unified transaction type for the list
type TxItem =
  | { kind: 'expense'; data: Expense; dateKey: string; sortKey: string }
  | { kind: 'income';  data: Income;  dateKey: string; sortKey: string };

/** Merge and sort expenses + income entries newest-first */
function buildTransactions(expenses: Expense[], incomeEntries: Income[]): TxItem[] {
  const items: TxItem[] = [
    ...expenses.map((e): TxItem => ({
      kind: 'expense',
      data: e,
      dateKey: e.date,
      sortKey: `${e.date}T${e.createdAt.slice(11)}`,
    })),
    ...incomeEntries.map((i): TxItem => ({
      kind: 'income',
      data: i,
      dateKey: i.createdAt.slice(0, 10),
      sortKey: i.createdAt,
    })),
  ];
  return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

/** Group a sorted transaction array by date */
function groupByDate(items: TxItem[]): { label: string; items: TxItem[] }[] {
  const groups: { label: string; items: TxItem[] }[] = [];
  const seen = new Map<string, number>();
  for (const item of items) {
    const label = dateGroupLabel(item.dateKey);
    if (seen.has(label)) {
      groups[seen.get(label)!].items.push(item);
    } else {
      seen.set(label, groups.length);
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

interface Filters { from?: string; to?: string; categoryIds?: string[]; page: number; pageSize: number; }
const DEFAULT_FILTERS: Filters = { page: 1, pageSize: 20 };

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

// ─── Receipt indicator ────────────────────────────────────────────────────────

function ReceiptIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-label="Has receipt">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  );
}

function RecurringIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-label="Recurring expense">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: Category | undefined }) {
  if (!category) return <span className="text-gray-400 text-sm">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span role="img" aria-label={category.name}>{category.icon}</span>
      <span className="text-gray-700 dark:text-gray-200">{category.name}</span>
    </span>
  );
}

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteDialog({ expense, onCancel, onConfirm, isPending, error }: {
  expense: Expense; onCancel: () => void; onConfirm: () => void; isPending: boolean; error: string | null;
}) {
  const { formatMoney } = useSettings();

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isPending) onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isPending, onCancel]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      // pb-24 clears the mobile bottom nav (≈80px + safe area)
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 md:pb-4"
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={!isPending ? onCancel : undefined} aria-hidden="true" />
      <div className={`relative z-10 w-full max-w-sm ${glass} p-6`}>
        <h2 id="delete-dialog-title" className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">Delete expense?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">This action cannot be undone.</p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
          {formatMoney(expense.amount)}{expense.description ? ` — ${expense.description}` : ''}
        </p>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50/80 dark:bg-red-900/20 border border-red-200/60 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={isPending}
            className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ walletName }: { walletName: string | null }) {
  if (walletName) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20 leading-none">
        <span className="text-gray-400 dark:text-gray-500 font-normal">from</span>
        <BrandLogo label={walletName} size={12} />
        {walletName}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20 leading-none">
      <span className="font-normal">from</span> 🏦 Salary
    </span>
  );
}
// ─── Mobile income row (read-only, no swipe) ─────────────────────────────────

function MobileIncomeRow({ income }: { income: Income }) {
  const { formatMoney } = useSettings();
  const dateStr = new Date(income.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  return (
    <li className="border-b border-black/[0.05] dark:border-white/[0.05] last:border-0">
      <div className="flex w-full items-center gap-3 px-4 py-3 bg-white/50 dark:bg-[#161626]">
        <BrandLogo label={income.label} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{income.label}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
            {income.recurringId ? '🔁 Recurring income' : '💰 Income'} · {dateStr}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          +{formatMoney(income.amount)}
        </span>
      </div>
    </li>
  );
}

// ─── Mobile expense row — swipe left to delete (react-swipeable-list) ────────

function MobileExpenseRow({
  expense,
  category,
  walletName,
  isExiting,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  category: Category | undefined;
  walletName: string | null;
  isExiting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { formatMoney } = useSettings();

  const trailingActions = () => (
    <TrailingActions>
      <SwipeAction onClick={onDelete}>
        <div className="flex flex-col items-center justify-center gap-0.5 h-full w-20 bg-red-500 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] font-semibold">Delete</span>
        </div>
      </SwipeAction>
    </TrailingActions>
  );

  return (
    <li className={`border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 ${isExiting ? 'item-exit' : 'item-enter'}`}>
      <SwipeableListItem
        trailingActions={trailingActions()}
        destructiveCallbackDelay={300}
        threshold={0.3}
        onClick={onEdit}
      >
        <div className="flex w-full items-center gap-3 px-4 py-3 bg-white/50 dark:bg-[#161626]">
          {/* Icon */}
          <div className="shrink-0">
            {expense.description && getDomainFromLabel(expense.description)
              ? <BrandLogo label={expense.description} size={40} />
              : <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-white/90 border border-black/[0.07] dark:border-white/[0.10] shadow-sm shadow-black/[0.04] text-lg"
                  aria-hidden="true"
                >
                  {category?.icon ?? '💸'}
                </span>
            }
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                {expense.description ?? category?.name ?? '—'}
              </p>
              {expense.recurringId && <RecurringIcon />}
              {expense.receiptUrl && <ReceiptIcon />}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {category?.name && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{category.name}</p>
              )}
              {category?.name && <span className="text-gray-300 dark:text-gray-600 text-xs" aria-hidden="true">·</span>}
              <SourceBadge walletName={walletName} />
            </div>
          </div>

          {/* Amount */}
          <span className="shrink-0 text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">
            −{formatMoney(expense.amount)}
          </span>
        </div>
      </SwipeableListItem>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { formatMoney } = useSettings();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Current month for income entries
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { exitingIds, triggerDelete: triggerDeleteExpense } = useAnimatedDelete(['expenses']);

  function deleteExpense(id: string) {
    triggerDeleteExpense(id, async () => {
      await expensesApi.delete(id);
      queryClient.refetchQueries({ queryKey: ['dashboard-recent'] });
      queryClient.refetchQueries({ queryKey: ['dashboard-summary'] });
      queryClient.refetchQueries({ queryKey: ['dashboard-trend'] });
    });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['expenses'] });
      queryClient.refetchQueries({ queryKey: ['dashboard-recent'] });
      queryClient.refetchQueries({ queryKey: ['dashboard-summary'] });
      queryClient.refetchQueries({ queryKey: ['dashboard-trend'] });
      setDeletingExpense(null); setDeleteError(null);
    },
    onError: (err: unknown) => setDeleteError(err instanceof Error ? err.message : 'Failed to delete expense.'),
  });

  function openEdit(expense: Expense) { navigate(`/expenses/${expense.id}`); }
  function closeForm() { setShowForm(false); }
  function closeDelete() { if (deleteMutation.isPending) return; setDeletingExpense(null); setDeleteError(null); }

  const { data: expensesData, isLoading: expensesLoading, isError: expensesError, refetch } = useQuery<PaginatedResult<Expense>>({
    queryKey: ['expenses', filters],
    queryFn: () => expensesApi.list(filters).then((r) => r.data),
    placeholderData: (prev) => prev,
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    staleTime: 10 * 60 * 1000, // categories rarely change
  });
  const { data: wallets = [] } = useQuery<Wallet[]>({
    queryKey: ['wallets'],
    queryFn: () => walletsApi.list().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  // Income entries for current month — shown alongside expenses
  const { data: incomeEntries = [] } = useQuery<Income[]>({
    queryKey: ['income-entries', year, month],
    queryFn: () => incomeApi.listEntries(year, month).then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const walletMap = new Map(wallets.map((w) => [w.id, w]));

  // Only merge income when no date filter is active (income has no date field to filter by)
  const mergedIncome = (!filters.from && !filters.to) ? incomeEntries : [];
  const transactions = expensesData ? buildTransactions(expensesData.data, mergedIncome) : [];
  const groups = groupByDate(transactions);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }
  function toggleCategory(id: string) {
    setFilters((prev) => {
      const current = prev.categoryIds ?? [];
      const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
      return { ...prev, categoryIds: next.length ? next : undefined, page: 1 };
    });
  }

  const hasActiveFilters = !!filters.from || !!filters.to || (filters.categoryIds?.length ?? 0) > 0;
  const totalPages = expensesData ? Math.max(1, Math.ceil(expensesData.total / filters.pageSize)) : 1;

  // Page-level total (expenses only — income is additive, shown separately)
  const pageTotal = expensesData?.data.reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const hasMultiplePages = totalPages > 1;

  return (
    <div className="space-y-5">

      {/* Filter bar */}
      <div className={`${glass} p-4 space-y-3 overflow-visible`}>
        {/* Date range + Add button row */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex items-center gap-2">
            <DatePicker id="filter-from" label="From" value={filters.from ?? ''} onChange={(v) => setFilter('from', v || undefined)} max={filters.to} />
            <span className="text-gray-400 mt-5">–</span>
            <DatePicker id="filter-to" label="To" value={filters.to ?? ''} onChange={(v) => setFilter('to', v || undefined)} min={filters.from} align="right" />
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            {hasActiveFilters && (
              <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)}
                className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none">
                Clear
              </button>
            )}
            <button type="button" onClick={() => { setShowForm(true); }}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20">
              + Add
            </button>
          </div>
        </div>

        {/* Category chips — tap to toggle, no multi-select */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 self-center mr-1">Categories:</span>
            {categories.map((cat) => {
              const active = (filters.categoryIds ?? []).includes(cat.id);
              return (
                <button key={cat.id} type="button" onClick={() => toggleCategory(cat.id)}
                  className={[
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 focus:outline-none',
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-black/[0.04] dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 hover:bg-black/[0.07] dark:hover:bg-white/[0.07]',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  <span aria-hidden="true">{cat.icon}</span>
                  {cat.name}
                  {active && <span aria-hidden="true" className="ml-0.5 opacity-70">×</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Expense list */}
      <div className={`${glass} overflow-hidden`}>
        {expensesLoading ? (
          <div className="divide-y divide-black/[0.05]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 gap-3" aria-hidden="true">
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-24 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-32 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
                </div>
                <div className="h-4 w-16 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
              </div>
            ))}
          </div>
        ) : expensesError ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Failed to load expenses.</p>
            <button type="button" onClick={() => refetch()}
              className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none">
              Retry
            </button>
          </div>
        ) : !expensesData?.data.length && groups.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">No expenses found.</p>
            {hasActiveFilters
              ? <p className="text-xs text-gray-400 dark:text-gray-500">Try adjusting or clearing your filters.</p>
              : <button type="button" onClick={() => { setShowForm(true); }}
                  className="mt-1 text-sm text-indigo-500 dark:text-indigo-400 hover:underline focus:outline-none">
                  Add your first expense
                </button>
            }
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">From</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 w-16"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {groups.map(({ label, items }) => (
                  <React.Fragment key={label}>
                    <tr aria-hidden="true">
                      <td colSpan={6} className="px-4 pt-3 pb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</span>
                      </td>
                    </tr>
                    {items.map((tx) => {
                      if (tx.kind === 'income') {
                        const inc = tx.data;
                        const incDate = new Date(inc.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
                        return (
                          <tr key={`i-${inc.id}`} className="item-enter">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{incDate}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                {inc.recurringId ? '🔁 Recurring' : '💰 Income'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{inc.label}</td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">+ Added</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                              +{formatMoney(inc.amount)}
                            </td>
                            <td />
                          </tr>
                        );
                      }
                      const expense = tx.data;
                      const walletName = expense.walletId ? (walletMap.get(expense.walletId)?.name ?? null) : null;
                      return (
                        <tr key={`e-${expense.id}`} onClick={() => openEdit(expense)}
                          className={`group cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors ${exitingIds.has(expense.id) ? 'item-exit' : 'item-enter'}`}
                          tabIndex={0} role="button"
                          aria-label={`View expense: ${expense.description ?? formatDate(expense.date)}`}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(expense); } }}>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(expense.date)}</td>
                          <td className="px-4 py-3"><CategoryBadge category={categoryMap.get(expense.categoryId)} /></td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200 max-w-xs">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate">{expense.description ?? <span className="text-gray-400">—</span>}</span>
                              {expense.recurringId && <RecurringIcon />}
                              {expense.receiptUrl && <ReceiptIcon />}
                            </div>
                          </td>
                          <td className="px-4 py-3"><SourceBadge walletName={walletName} /></td>
                          <td className="px-4 py-3 text-right font-semibold text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">
                            −{formatMoney(expense.amount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                              <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">View</span>
                              <button type="button" onClick={(e) => { e.stopPropagation(); deleteExpense(expense.id); }}
                                className="rounded-lg p-1 text-gray-400 hover:bg-red-50/80 hover:text-red-500 transition-all focus:outline-none"
                                aria-label={`Delete expense: ${expense.description ?? formatDate(expense.date)}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
              {/* Total footer row */}
              <tfoot>
                <tr className="border-t border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02]">
                  <td colSpan={4} className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500">
                    {hasMultiplePages ? `Page ${filters.page} total` : `Total · ${expensesData?.data.length ?? 0} expense${(expensesData?.data.length ?? 0) !== 1 ? 's' : ''}`}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">{formatMoney(pageTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>

            {/* Mobile list — date-grouped sections, individual rows */}
            <SwipeableList type={ListType.IOS} Tag="ul" className="md:hidden">
              {groups.map(({ label, items }) => (
                <React.Fragment key={label}>
                  {/* Date section header */}
                  <li className="sticky top-0 z-10 px-4 py-2 bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-sm border-b border-black/[0.05] dark:border-white/[0.05]">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</span>
                  </li>
                  {items.map((tx) =>
                    tx.kind === 'income' ? (
                      <MobileIncomeRow key={`i-${tx.data.id}`} income={tx.data} />
                    ) : (
                      <MobileExpenseRow
                        key={`e-${tx.data.id}`}
                        expense={tx.data}
                        category={categoryMap.get(tx.data.categoryId)}
                        walletName={tx.data.walletId ? (walletMap.get(tx.data.walletId)?.name ?? null) : null}
                        isExiting={exitingIds.has(tx.data.id)}
                        onEdit={() => openEdit(tx.data)}
                        onDelete={() => setDeletingExpense(tx.data)}
                      />
                    )
                  )}
                </React.Fragment>
              ))}
              {/* Mobile total footer */}
              <li className="flex items-center justify-between px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.06]">
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                  {hasMultiplePages ? `Page ${filters.page} total` : `${expensesData?.data.length ?? 0} expense${(expensesData?.data.length ?? 0) !== 1 ? 's' : ''}`}
                </span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">{formatMoney(pageTotal)}</span>
              </li>
            </SwipeableList>
          </>
        )}
      </div>

      {/* Pagination */}
      {!expensesError && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{expensesData ? `${expensesData.total} total expense${expensesData.total !== 1 ? 's' : ''}` : ''}</span>
          <div className="flex items-center gap-3">
            <button type="button" disabled={filters.page <= 1 || expensesLoading}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none">
              Previous
            </button>
            <span>Page {filters.page} of {totalPages}</span>
            <button type="button" disabled={filters.page >= totalPages || expensesLoading}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Expense form modal */}
      <BottomSheet open={showForm} onClose={closeForm} title="Add expense">
        <ExpenseForm onSuccess={closeForm} onCancel={closeForm} />
      </BottomSheet>

      {deletingExpense && (
        <DeleteDialog expense={deletingExpense} onCancel={closeDelete}
          onConfirm={() => deleteMutation.mutate(deletingExpense.id)}
          isPending={deleteMutation.isPending} error={deleteError} />
      )}
    </div>
  );
}
