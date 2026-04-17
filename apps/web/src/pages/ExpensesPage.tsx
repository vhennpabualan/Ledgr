import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi, categoriesApi } from '../lib/api';
import type { Expense, Category, PaginatedResult } from '@ledgr/types';
import ExpenseForm from '../components/ExpenseForm';
import DatePicker from '../components/DatePicker';
import BottomSheet from '../components/BottomSheet';

function formatPHP(minorUnits: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'symbol' }).format(minorUnits / 100);
}
function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
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
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className={`relative z-10 w-full max-w-sm ${glass} p-6`}>
        <h2 id="delete-dialog-title" className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">Delete expense?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">This action cannot be undone.</p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
          {formatPHP(expense.amount)}{expense.description ? ` — ${expense.description}` : ''}
        </p>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50/80 dark:bg-red-900/20 border border-red-200/60 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={isPending}
            className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors focus:outline-none">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-40 transition-colors focus:outline-none">
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setDeletingExpense(null); setDeleteError(null); },
    onError: (err: unknown) => setDeleteError(err instanceof Error ? err.message : 'Failed to delete expense.'),
  });

  function openEdit(expense: Expense) { setEditingExpense(expense); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditingExpense(undefined); }
  function openDelete(e: React.MouseEvent, expense: Expense) { e.stopPropagation(); setDeleteError(null); setDeletingExpense(expense); }
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
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

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

  // Page-level total (sum of current page only — labeled clearly)
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
            <button type="button" onClick={() => { setEditingExpense(undefined); setShowForm(true); }}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20">
              + Add Expense
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
        ) : !expensesData?.data.length ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">No expenses found. Try adjusting your filters.</p>
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
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 w-16"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {expensesData.data.map((expense) => (
                  <tr key={expense.id} onClick={() => openEdit(expense)}
                    className="group cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    tabIndex={0} role="button"
                    aria-label={`Edit expense: ${expense.description ?? formatDate(expense.date)}`}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(expense); } }}>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(expense.date)}</td>
                    <td className="px-4 py-3"><CategoryBadge category={categoryMap.get(expense.categoryId)} /></td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 max-w-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{expense.description ?? <span className="text-gray-400">—</span>}</span>
                        {expense.receiptUrl && <ReceiptIcon />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-100 tabular-nums whitespace-nowrap">{formatPHP(expense.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                        {/* Edit affordance */}
                        <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">Edit</span>
                        <button type="button" onClick={(e) => openDelete(e, expense)}
                          className="rounded-lg p-1 text-gray-400 hover:bg-red-50/80 hover:text-red-500 transition-all focus:outline-none"
                          aria-label={`Delete expense: ${expense.description ?? formatDate(expense.date)}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Total footer row */}
              <tfoot>
                <tr className="border-t border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02]">
                  <td colSpan={3} className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500">
                    {hasMultiplePages ? `Page ${filters.page} total` : `Total · ${expensesData.data.length} expense${expensesData.data.length !== 1 ? 's' : ''}`}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">{formatPHP(pageTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>

            {/* Mobile list */}
            <ul className="md:hidden divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {expensesData.data.map((expense) => (
                <li key={expense.id} className="relative">
                  <div role="button" tabIndex={0} onClick={() => openEdit(expense)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(expense); } }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:bg-black/[0.04] dark:active:bg-white/[0.04] transition-colors cursor-pointer"
                    aria-label={`Edit expense: ${expense.description ?? formatDate(expense.date)}`}>
                    <span className="text-xl shrink-0" aria-hidden="true">{categoryMap.get(expense.categoryId)?.icon ?? '💸'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                          {expense.description ?? categoryMap.get(expense.categoryId)?.name ?? '—'}
                        </p>
                        {expense.receiptUrl && <ReceiptIcon />}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {formatDate(expense.date)}
                        {categoryMap.get(expense.categoryId) && <span className="ml-1.5">· {categoryMap.get(expense.categoryId)!.name}</span>}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums pr-10">{formatPHP(expense.amount)}</span>
                  </div>
                  <button type="button" onClick={(e) => openDelete(e, expense)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:bg-red-50/80 hover:text-red-500 transition-colors focus:outline-none"
                    aria-label={`Delete expense: ${expense.description ?? formatDate(expense.date)}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </li>
              ))}
              {/* Mobile total footer */}
              <li className="flex items-center justify-between px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.06]">
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                  {hasMultiplePages ? `Page ${filters.page} total` : `${expensesData.data.length} expense${expensesData.data.length !== 1 ? 's' : ''}`}
                </span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">{formatPHP(pageTotal)}</span>
              </li>
            </ul>
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
      <BottomSheet open={showForm} onClose={closeForm} title={editingExpense ? 'Edit expense' : 'Add expense'}>
        <ExpenseForm expense={editingExpense} onSuccess={closeForm} onCancel={closeForm} />
      </BottomSheet>

      {deletingExpense && (
        <DeleteDialog expense={deletingExpense} onCancel={closeDelete}
          onConfirm={() => deleteMutation.mutate(deletingExpense.id)}
          isPending={deleteMutation.isPending} error={deleteError} />
      )}
    </div>
  );
}
