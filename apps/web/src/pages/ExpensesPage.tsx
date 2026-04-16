import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi, categoriesApi } from '../lib/api';
import type { Expense, Category, PaginatedResult } from '@ledgr/types';
import ExpenseForm from '../components/ExpenseForm';
import DatePicker from '../components/DatePicker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert minor units (centavos) → "₱1,234.56" */
function formatPHP(minorUnits: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    currencyDisplay: 'symbol',
  }).format(minorUnits / 100);
}

/** "2024-06-15" → "Jun 15, 2024" */
function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Filters {
  from?: string;
  to?: string;
  categoryIds?: string[];
  page: number;
  pageSize: number;
}

const DEFAULT_FILTERS: Filters = { page: 1, pageSize: 20 };

// ─── Sub-components ───────────────────────────────────────────────────────────


interface CategoryBadgeProps {
  category: Category | undefined;
}
function CategoryBadge({ category }: CategoryBadgeProps) {
  if (!category) return <span className="text-gray-400 text-sm">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span role="img" aria-label={category.name}>{category.icon}</span>
      <span className="text-gray-700">{category.name}</span>
    </span>
  );
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

interface DeleteDialogProps {
  expense: Expense;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
  error: string | null;
}

function DeleteDialog({ expense, onCancel, onConfirm, isPending, error }: DeleteDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
        <h2 id="delete-dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
          Delete expense?
        </h2>
        <p className="text-sm text-gray-500 mb-1">
          This will remove the expense from your records. This action cannot be undone.
        </p>
        {/* Show the expense amount/description for context */}
        <p className="text-sm font-medium text-gray-700 mb-4">
          {formatPHP(expense.amount)}{expense.description ? ` — ${expense.description}` : ''}
        </p>

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setDeletingExpense(null);
      setDeleteError(null);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Failed to delete expense. Please try again.';
      setDeleteError(message);
    },
  });

  function openCreate() {
    setEditingExpense(undefined);
    setShowForm(true);
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingExpense(undefined);
  }

  function openDelete(e: React.MouseEvent, expense: Expense) {
    e.stopPropagation(); // prevent row click from opening edit
    setDeleteError(null);
    setDeletingExpense(expense);
  }

  function closeDelete() {
    if (deleteMutation.isPending) return;
    setDeletingExpense(null);
    setDeleteError(null);
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: expensesData,
    isLoading: expensesLoading,
    isError: expensesError,
    refetch,
  } = useQuery<PaginatedResult<Expense>>({
    queryKey: ['expenses', filters],
    queryFn: () => expensesApi.list(filters).then((r) => r.data),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // ── Filter helpers ─────────────────────────────────────────────────────────

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function toggleCategory(id: string) {
    setFilters((prev) => {
      const current = prev.categoryIds ?? [];
      const next = current.includes(id)
        ? current.filter((c) => c !== id)
        : [...current, id];
      return { ...prev, categoryIds: next.length ? next : undefined, page: 1 };
    });
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  const hasActiveFilters =
    !!filters.from || !!filters.to || (filters.categoryIds?.length ?? 0) > 0;

  // ── Pagination ─────────────────────────────────────────────────────────────

  const totalPages = expensesData
    ? Math.max(1, Math.ceil(expensesData.total / filters.pageSize))
    : 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Expenses</h1>
        <button
          type="button"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          onClick={openCreate}
        >
          + Add Expense
        </button>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-end">
          {/* Date range */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DatePicker
              id="filter-from"
              label="From"
              value={filters.from ?? ''}
              onChange={(v) => setFilter('from', v || undefined)}
              max={filters.to}
            />
            <span className="text-gray-400 mt-5">–</span>
            <DatePicker
              id="filter-to"
              label="To"
              value={filters.to ?? ''}
              onChange={(v) => setFilter('to', v || undefined)}
              min={filters.from}
              align="right"
            />
          </div>

          {/* Category multi-select */}
          {categories.length > 0 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-categories" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Categories
              </label>
              <select
                id="filter-categories"
                multiple
                size={Math.min(categories.length, 4)}
                value={filters.categoryIds ?? []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setFilters((prev) => ({
                    ...prev,
                    categoryIds: selected.length ? selected : undefined,
                    page: 1,
                  }));
                }}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-w-[160px]"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="self-end rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Active category chips (for checkbox-style UX alongside the select) */}
        {(filters.categoryIds?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.categoryIds!.map((id) => {
              const cat = categoryMap.get(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleCategory(id)}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  aria-label={`Remove ${cat?.name ?? id} filter`}
                >
                  {cat?.icon} {cat?.name ?? id}
                  <span aria-hidden="true" className="ml-0.5 text-gray-400">×</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Expense list */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {expensesLoading ? (
          /* Skeleton — shared between mobile and desktop */
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 gap-3" aria-hidden="true">
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-24 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
                </div>
                <div className="h-4 w-16 rounded bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
        ) : expensesError ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-gray-500 mb-3">Failed to load expenses. Try again.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              Retry
            </button>
          </div>
        ) : !expensesData?.data.length ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-gray-400">No expenses yet. Add your first expense.</p>
          </div>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 w-10"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expensesData.data.map((expense) => (
                  <tr
                    key={expense.id}
                    onClick={() => openEdit(expense)}
                    className="group cursor-pointer hover:bg-gray-50 transition-colors"
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit expense: ${expense.description ?? formatDate(expense.date)}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(expense); }
                    }}
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(expense.date)}</td>
                    <td className="px-4 py-3"><CategoryBadge category={categoryMap.get(expense.categoryId)} /></td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{expense.description ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums whitespace-nowrap">{formatPHP(expense.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => openDelete(e, expense)}
                        className="rounded p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                        aria-label={`Delete expense: ${expense.description ?? formatDate(expense.date)}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile card list — visible only on mobile */}
            <ul className="md:hidden divide-y divide-gray-100">
              {expensesData.data.map((expense) => (
                <li key={expense.id} className="relative">
                  {/* Row — div instead of button to avoid nested button violation */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openEdit(expense)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(expense); } }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                    aria-label={`Edit expense: ${expense.description ?? formatDate(expense.date)}`}
                  >
                    {/* Icon */}
                    <span className="text-xl shrink-0" aria-hidden="true">
                      {categoryMap.get(expense.categoryId)?.icon ?? '💸'}
                    </span>
                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {expense.description ?? categoryMap.get(expense.categoryId)?.name ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(expense.date)}
                        {categoryMap.get(expense.categoryId) && (
                          <span className="ml-1.5 text-gray-400">· {categoryMap.get(expense.categoryId)!.name}</span>
                        )}
                      </p>
                    </div>
                    {/* Amount */}
                    <span className="text-sm font-semibold text-gray-900 tabular-nums pr-10">
                      {formatPHP(expense.amount)}
                    </span>
                  </div>
                  {/* Delete — absolutely positioned so it's outside the div[role=button] */}
                  <button
                    type="button"
                    onClick={(e) => openDelete(e, expense)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label={`Delete expense: ${expense.description ?? formatDate(expense.date)}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Pagination */}
      {!expensesError && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {expensesData
              ? `${expensesData.total} expense${expensesData.total !== 1 ? 's' : ''}`
              : ''}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={filters.page <= 1 || expensesLoading}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              Previous
            </button>
            <span className="text-gray-500">
              Page {filters.page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={filters.page >= totalPages || expensesLoading}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Expense form modal */}
      {showForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingExpense ? 'Edit expense' : 'Add expense'}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeForm}
            aria-hidden="true"
          />
          {/* Panel — bottom sheet on mobile, centered modal on sm+ */}
          <div className="relative z-10 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl bg-white shadow-xl flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
            {/* Drag handle (mobile only) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
              <div className="h-1 w-10 rounded-full bg-gray-300" />
            </div>
            {/* Header */}
            <div className="px-6 pt-4 pb-2 sm:pt-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingExpense ? 'Edit expense' : 'Add expense'}
              </h2>
            </div>
            {/* Scrollable form body */}
            <div className="overflow-y-auto px-6 pb-6">
              <ExpenseForm
                expense={editingExpense}
                onSuccess={closeForm}
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deletingExpense && (
        <DeleteDialog
          expense={deletingExpense}
          onCancel={closeDelete}
          onConfirm={() => deleteMutation.mutate(deletingExpense.id)}
          isPending={deleteMutation.isPending}
          error={deleteError}
        />
      )}
    </div>
  );
}

