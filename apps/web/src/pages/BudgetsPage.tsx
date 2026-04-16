import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { budgetsApi, categoriesApi } from '../lib/api';
import type { Budget, BudgetStatus, Category, CreateBudgetDTO, PendingSpend } from '@ledgr/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert minor units → "₱1,234.56" */
function formatPHP(minorUnits: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    currencyDisplay: 'symbol',
  }).format(minorUnits / 100);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function extractError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}


// ─── Budget card ──────────────────────────────────────────────────────────────

interface BudgetCardProps {
  budget: Budget;
  category: Category | undefined;
  onDelete: (id: string) => void;
  deleteError: string | null;
}

function BudgetCard({ budget, category, onDelete, deleteError }: BudgetCardProps) {
  const queryClient = useQueryClient();
  const [showPending, setShowPending] = useState(false);
  const [pendingLabel, setPendingLabel] = useState('');
  const [pendingAmount, setPendingAmount] = useState('');
  const [pendingFormError, setPendingFormError] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<BudgetStatus>({
    queryKey: ['budget-status', budget.id],
    queryFn: () => budgetsApi.getStatus(budget.id).then((r) => r.data),
  });

  const { data: pendingItems = [], isLoading: pendingLoading } = useQuery<PendingSpend[]>({
    queryKey: ['budget-pending', budget.id],
    queryFn: () => budgetsApi.listPending(budget.id).then((r) => r.data),
    enabled: showPending,
  });

  const addPendingMutation = useMutation({
    mutationFn: ({ amount, label }: { amount: number; label: string }) =>
      budgetsApi.addPending(budget.id, { amount, label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-pending', budget.id] });
      queryClient.invalidateQueries({ queryKey: ['budget-status', budget.id] });
      setPendingLabel('');
      setPendingAmount('');
      setPendingFormError(null);
    },
    onError: () => setPendingFormError('Failed to add item.'),
  });

  const removePendingMutation = useMutation({
    mutationFn: (itemId: string) => budgetsApi.deletePending(budget.id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-pending', budget.id] });
      queryClient.invalidateQueries({ queryKey: ['budget-status', budget.id] });
    },
  });

  function submitPending(e: React.FormEvent) {
    e.preventDefault();
    const amt = Math.round(parseFloat(pendingAmount) * 100);
    if (!pendingLabel.trim()) return setPendingFormError('Label is required.');
    if (isNaN(amt) || amt <= 0) return setPendingFormError('Enter a valid amount.');
    addPendingMutation.mutate({ amount: amt, label: pendingLabel.trim() });
  }

  // Progress bar fills: spent (dark) + pending (amber) stacked
  const spentPct  = status ? Math.min((status.spent / budget.limitAmount) * 100, 100) : 0;
  const pendingPct = status ? Math.min((status.pending / budget.limitAmount) * 100, 100 - spentPct) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 hover:border-gray-300 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {category ? (
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-lg"
              style={{ backgroundColor: category.color + '22', color: category.color }}
              aria-hidden="true"
            >
              {category.icon}
            </div>
          ) : (
            <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-gray-100 animate-pulse" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold text-gray-900 truncate">{category?.name ?? '—'}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {status?.isOverBudget && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              Over budget!
            </span>
          )}
          {/* Pending toggle */}
          <button
            type="button"
            onClick={() => setShowPending((v) => !v)}
            title="Pending spend"
            className={`rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              showPending ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:bg-amber-50 hover:text-amber-600'
            }`}
            aria-label="Toggle pending spend"
            aria-expanded={showPending}
          >
            {/* Clock icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </button>
          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(budget.id)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label={`Delete ${category?.name ?? 'budget'} budget`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {deleteError && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {deleteError}
        </p>
      )}

      {/* Amounts */}
      {statusLoading ? (
        <div className="space-y-2" aria-hidden="true">
          <div className="h-3.5 w-3/4 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
          <div className="h-2 w-full rounded-full bg-gray-100 animate-pulse mt-3" />
        </div>
      ) : status ? (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Budget</dt>
              <dd className="text-sm font-semibold text-gray-900 tabular-nums">{formatPHP(budget.limitAmount)}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-amber-500 uppercase tracking-wide mb-0.5">Pending</dt>
              <dd className="text-sm font-semibold text-amber-600 tabular-nums">{formatPHP(status.pending)}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Available</dt>
              <dd className={`text-sm font-semibold tabular-nums ${status.remaining < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {formatPHP(status.remaining)}
              </dd>
            </div>
          </dl>

          {/* Spent sub-line — less prominent, just for reference */}
          <p className="text-xs text-gray-400 text-center -mt-1">
            <span className={status.isOverBudget ? 'text-red-500' : 'text-gray-500'}>
              {formatPHP(status.spent)} spent in {category?.name ?? 'this category'}
            </span>
          </p>

          {/* Stacked progress bar: spent + pending */}
          <div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden flex">
              <div
                className="h-full bg-gray-800 transition-all duration-300"
                style={{ width: `${spentPct}%` }}
                aria-hidden="true"
              />
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${pendingPct}%` }}
                aria-hidden="true"
              />
            </div>
            <p className="text-xs text-gray-400 text-right tabular-nums mt-1">
              {Math.round(spentPct + pendingPct)}% committed
            </p>
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400">Could not load status.</p>
      )}

      {/* Pending spend panel */}
      {showPending && (
        <div className="border-t border-gray-100 pt-3 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending spend</p>

          {/* Existing items */}
          {pendingLoading ? (
            <div className="space-y-1.5" aria-hidden="true">
              {[1,2].map((i) => <div key={i} className="h-3 rounded bg-gray-100 animate-pulse" />)}
            </div>
          ) : pendingItems.length === 0 ? (
            <p className="text-xs text-gray-400">No pending items. Add one below.</p>
          ) : (
            <ul className="space-y-1.5">
              {pendingItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-700 truncate">{item.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-amber-600 tabular-nums">{formatPHP(item.amount)}</span>
                    <button
                      type="button"
                      onClick={() => removePendingMutation.mutate(item.id)}
                      disabled={removePendingMutation.isPending}
                      className="text-gray-300 hover:text-red-500 transition-colors focus:outline-none"
                      aria-label={`Remove ${item.label}`}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Add form */}
          <form onSubmit={submitPending} className="flex gap-2 items-start">
            <div className="flex-1 min-w-0 space-y-1.5">
              <input
                type="text"
                placeholder="Label (e.g. Shopee parcel)"
                value={pendingLabel}
                onChange={(e) => { setPendingLabel(e.target.value); setPendingFormError(null); }}
                maxLength={100}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Amount"
                value={pendingAmount}
                onChange={(e) => { setPendingAmount(e.target.value); setPendingFormError(null); }}
                min="0.01"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              {pendingFormError && <p className="text-xs text-red-500">{pendingFormError}</p>}
            </div>
            <button
              type="submit"
              disabled={addPendingMutation.isPending}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 shrink-0 mt-0"
            >
              {addPendingMutation.isPending ? '…' : 'Add'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-100 bg-white p-5 space-y-4" aria-hidden="true">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-4 w-28 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((j) => (
              <div key={j} className="space-y-1.5">
                <div className="h-3 w-10 mx-auto rounded bg-gray-100 animate-pulse" />
                <div className="h-4 w-16 mx-auto rounded bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 animate-pulse" />
        </div>
      ))}
    </>
  );
}

// ─── Budget form ──────────────────────────────────────────────────────────────

interface BudgetFormProps {
  categories: Category[];
  year: number;
  month: number;
  onSuccess: () => void;
  onCancel: () => void;
}

function BudgetForm({ categories, year, month, onSuccess, onCancel }: BudgetFormProps) {
  const queryClient = useQueryClient();

  const [categoryId, setCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [rollover, setRollover] = useState(false);
  const [formYear, setFormYear] = useState(year);
  const [formMonth, setFormMonth] = useState(month);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const CURRENCIES = ['PHP', 'USD', 'EUR'];

  // Only non-archived categories
  const activeCategories = categories.filter((c) => !c.isArchived);
  const selectedCategory = activeCategories.find((c) => c.id === categoryId);

  const createMutation = useMutation({
    mutationFn: (data: CreateBudgetDTO) => budgetsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      onSuccess();
    },
    onError: (err: unknown) => {
      // Surface 409 conflict with a friendly message
      const msg = extractError(err);
      if (msg.includes('409') || msg.toLowerCase().includes('conflict')) {
        setFormError('A budget already exists for this period.');
      } else {
        setFormError(msg);
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!categoryId) return setFormError('Please select a category.');

    const parsed = Math.round(parseFloat(limitAmount) * 100);
    if (!limitAmount || isNaN(parsed) || parsed <= 0) {
      return setFormError('Limit must be a positive amount.');
    }

    createMutation.mutate({
      categoryId,
      limitAmount: parsed,
      currency,
      year: formYear,
      month: formMonth,
      rollover,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Category <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        {/* Custom dropdown — avoids native <select> overflow issues inside modals on mobile */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setCategoryOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={categoryOpen}
            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors ${
              categoryId ? 'text-gray-900 border-gray-300' : 'text-gray-400 border-gray-300'
            }`}
          >
            <span>
              {selectedCategory
                ? `${selectedCategory.icon} ${selectedCategory.name}`
                : 'Select a category…'}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${categoryOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {categoryOpen && (
            <>
              {/* Click-away overlay */}
              <div className="fixed inset-0 z-10" onClick={() => setCategoryOpen(false)} aria-hidden="true" />
              <ul
                role="listbox"
                aria-label="Category"
                className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto py-1"
              >
                {activeCategories.map((c) => (
                  <li
                    key={c.id}
                    role="option"
                    aria-selected={c.id === categoryId}
                    onClick={() => { setCategoryId(c.id); setCategoryOpen(false); setFormError(null); }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none transition-colors ${
                      c.id === categoryId
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span aria-hidden="true">{c.icon}</span>
                    {c.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Limit amount */}
      <div className="flex flex-col gap-1">
        <label htmlFor="budget-limit" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Limit amount <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          {/* Currency custom dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCurrencyOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={currencyOpen}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
              aria-label="Currency"
            >
              {currency}
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 text-gray-400 transition-transform ${currencyOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {currencyOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCurrencyOpen(false)} aria-hidden="true" />
                <ul role="listbox" aria-label="Currency" className="absolute z-20 mt-1 w-20 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                  {CURRENCIES.map((c) => (
                    <li
                      key={c}
                      role="option"
                      aria-selected={currency === c}
                      onClick={() => { setCurrency(c); setCurrencyOpen(false); }}
                      className={`px-3 py-2 text-sm cursor-pointer select-none transition-colors ${currency === c ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <input
            id="budget-limit"
            type="number"
            min="0.01"
            step="0.01"
            value={limitAmount}
            onChange={(e) => setLimitAmount(e.target.value)}
            placeholder="0.00"
            required
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
      </div>

      {/* Month / Year */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Month
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMonthOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={monthOpen}
              className="w-full flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 text-left focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
            >
              <span>{MONTH_NAMES[formMonth - 1]}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${monthOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {monthOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMonthOpen(false)} aria-hidden="true" />
                <ul
                  role="listbox"
                  aria-label="Month"
                  className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto py-1"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <li
                      key={i + 1}
                      role="option"
                      aria-selected={formMonth === i + 1}
                      onClick={() => { setFormMonth(i + 1); setMonthOpen(false); }}
                      className={`px-3 py-2 text-sm cursor-pointer select-none transition-colors ${
                        formMonth === i + 1
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="budget-year" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Year
          </label>
          <input
            id="budget-year"
            type="number"
            min={2020}
            max={2099}
            value={formYear}
            onChange={(e) => setFormYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
      </div>

      {/* Rollover */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={rollover}
          onChange={(e) => setRollover(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
        />
        <span className="text-sm text-gray-700">Roll over unused budget to next month</span>
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={createMutation.isPending}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          {createMutation.isPending ? 'Saving…' : 'Add budget'}
        </button>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsApi.delete(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setDeletingId(null);
      setDeleteErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    },
    onError: (err: unknown, id) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete budget.';
      setDeleteErrors((prev) => ({ ...prev, [id]: msg }));
      setDeletingId(null);
    },
  });

  function handleDeleteRequest(id: string) {
    setDeletingId(id);
  }

  function confirmDelete() {
    if (deletingId) deleteMutation.mutate(deletingId);
  }

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  const {
    data: budgets = [],
    isLoading: budgetsLoading,
    isError: budgetsError,
    refetch,
  } = useQuery<Budget[]>({
    queryKey: ['budgets', year, month],
    queryFn: () => budgetsApi.list(year, month).then((r) => r.data),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">Budgets</h1>

          {/* Month/year navigation */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-0.5">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
              aria-label="Previous month"
            >
              {/* Chevron left */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="min-w-[120px] text-center text-sm font-medium text-gray-700 select-none">
              {formatMonthYear(year, month)}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
              aria-label="Next month"
            >
              {/* Chevron right */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          + Add Budget
        </button>
      </div>

      {/* Content */}
      {budgetsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCards />
        </div>
      ) : budgetsError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-6 py-10 text-center">
          <p className="text-sm text-red-600 mb-3">Failed to load budgets.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      ) : budgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
          <p className="text-sm text-gray-400">No budgets for this month. Add one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              category={categoryMap.get(budget.categoryId)}
              onDelete={handleDeleteRequest}
              deleteError={deleteErrors[budget.id] ?? null}
            />
          ))}
        </div>
      )}

      {/* Add budget modal */}
      {showForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add budget"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-semibold text-gray-900">Add budget</h2>
            </div>
            <div className="overflow-y-auto px-6 pb-6">
              <BudgetForm
                categories={categories}
                year={year}
                month={month}
                onSuccess={() => setShowForm(false)}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingId && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-budget-title" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeletingId(null)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
            <h2 id="delete-budget-title" className="text-lg font-semibold text-gray-900 mb-2">Delete budget?</h2>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently remove the budget. Your expense records won't be affected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
