import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { budgetsApi, categoriesApi } from '../lib/api';
import type { Budget, BudgetStatus, Category, CreateBudgetDTO, PendingSpend } from '@ledgr/types';

function formatPHP(minorUnits: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'symbol' }).format(minorUnits / 100);
}
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function formatMonthYear(year: number, month: number): string { return `${MONTH_NAMES[month - 1]} ${year}`; }
function extractError(err: unknown): string { return err instanceof Error ? err.message : 'Something went wrong.'; }

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

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
      setPendingLabel(''); setPendingAmount(''); setPendingFormError(null);
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

  const spentPct = status ? Math.min((status.spent / budget.limitAmount) * 100, 100) : 0;
  const pendingPct = status ? Math.min((status.pending / budget.limitAmount) * 100, 100 - spentPct) : 0;
  const isOver = status?.isOverBudget ?? false;
  const pendingCount = pendingItems.length;

  // Card left-border accent + bg tint for over-budget
  const cardAccent = isOver
    ? 'border-l-4 border-l-red-400 bg-red-50/40'
    : 'border-l-4 border-l-transparent';

  return (
    <div className={`${glass} ${cardAccent} p-5 space-y-4 transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {category ? (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg"
              style={{ backgroundColor: category.color + '22', color: category.color }} aria-hidden="true">
              {category.icon}
            </div>
          ) : (
            <div className="h-9 w-9 flex-shrink-0 rounded-xl bg-black/[0.06] animate-pulse" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate block">{category?.name ?? '—'}</span>
            {isOver && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                Over budget
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Pending toggle with count badge */}
          <div className="relative">
            <button type="button" onClick={() => setShowPending((v) => !v)}
              title="Pending spend"
              className={`rounded-xl p-1.5 transition-colors focus:outline-none ${
                showPending ? 'bg-amber-100/80 text-amber-600' : 'text-gray-400 hover:bg-amber-50/80 hover:text-amber-500'
              }`}
              aria-label="Toggle pending spend" aria-expanded={showPending}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </button>
            {/* Count badge — only shown when items exist and panel is closed */}
            {!showPending && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </div>
          {/* Delete */}
          <button type="button" onClick={() => onDelete(budget.id)}
            className="rounded-xl p-1.5 text-gray-400 hover:bg-red-50/80 hover:text-red-500 transition-colors focus:outline-none"
            aria-label={`Delete ${category?.name ?? 'budget'} budget`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {deleteError && (
        <p role="alert" className="text-xs text-red-500 dark:text-red-400 bg-red-50/60 dark:bg-red-900/20 border border-red-200/60 rounded-xl px-3 py-2">{deleteError}</p>
      )}

      {/* Amounts */}
      {statusLoading ? (
        <div className="space-y-2" aria-hidden="true">
          <div className="h-3.5 w-3/4 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
          <div className="h-3 w-1/2 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
          <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06] animate-pulse mt-3" />
        </div>
      ) : status ? (
        <>
          {/* Limit prominent, spent/remaining below */}
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Limit</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">{formatPHP(budget.limitAmount)}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Spent</p>
              <p className={`text-sm font-semibold tabular-nums ${isOver ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
                {formatPHP(status.spent)}
              </p>
            </div>
            <div className={`rounded-xl px-3 py-2 ${status.remaining < 0 ? 'bg-red-50/60 dark:bg-red-900/20' : 'bg-emerald-50/60 dark:bg-emerald-900/20'}`}>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Remaining</p>
              <p className={`text-sm font-semibold tabular-nums ${status.remaining < 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {formatPHP(status.remaining)}
              </p>
            </div>
          </div>

          {status.pending > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-900/20 px-3 py-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending reserved</p>
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{formatPHP(status.pending)}</p>
            </div>
          )}

          {/* Stacked progress bar — indigo for spent, amber for pending */}
          <div>
            <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06] overflow-hidden flex">
              <div className={`h-full transition-all duration-500 ${isOver ? 'bg-red-400' : 'bg-indigo-500'}`}
                style={{ width: `${spentPct}%` }} aria-hidden="true" />
              <div className="h-full bg-amber-400 transition-all duration-500"
                style={{ width: `${pendingPct}%` }} aria-hidden="true" />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right tabular-nums mt-1">
              {Math.round(spentPct + pendingPct)}% committed
            </p>
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">Could not load status.</p>
      )}

      {/* Pending spend panel */}
      {showPending && (
        <div className="border-t border-black/[0.06] dark:border-white/[0.06] pt-3 space-y-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Pending spend</p>

          {pendingLoading ? (
            <div className="space-y-1.5" aria-hidden="true">
              {[1,2].map((i) => <div key={i} className="h-3 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />)}
            </div>
          ) : pendingItems.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">No pending items. Add one below.</p>
          ) : (
            <ul className="space-y-1.5">
              {pendingItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/60 dark:bg-amber-900/20 border border-amber-200/50 px-3 py-1.5 text-xs">
                  <span className="text-gray-700 dark:text-gray-200 truncate">{item.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{formatPHP(item.amount)}</span>
                    <button type="button" onClick={() => removePendingMutation.mutate(item.id)}
                      disabled={removePendingMutation.isPending}
                      className="text-gray-300 hover:text-red-400 transition-colors focus:outline-none" aria-label={`Remove ${item.label}`}>
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={submitPending} className="space-y-2">
            <input type="text" placeholder="Label (e.g. Grab food)" value={pendingLabel} maxLength={100}
              onChange={(e) => { setPendingLabel(e.target.value); setPendingFormError(null); }}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <div className="flex gap-2">
              <input type="number" placeholder="Amount" value={pendingAmount} min="0.01" step="0.01"
                onChange={(e) => { setPendingAmount(e.target.value); setPendingFormError(null); }}
                className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <button type="submit" disabled={addPendingMutation.isPending}
                className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors focus:outline-none shrink-0">
                {addPendingMutation.isPending ? '…' : 'Add'}
              </button>
            </div>
            {pendingFormError && <p className="text-xs text-red-500 dark:text-red-400">{pendingFormError}</p>}
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={`${glass} p-5 space-y-4`} aria-hidden="true">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
            <div className="h-4 w-28 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
          </div>
          <div className="h-7 w-32 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
          <div className="grid grid-cols-2 gap-2">
            {[0,1].map((j) => <div key={j} className="h-12 rounded-xl bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />)}
          </div>
          <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
        </div>
      ))}
    </>
  );
}

// ─── Budget form ──────────────────────────────────────────────────────────────

interface BudgetFormProps { categories: Category[]; year: number; month: number; onSuccess: () => void; onCancel: () => void; }

function BudgetForm({ categories, year, month, onSuccess, onCancel }: BudgetFormProps) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [rollover, setRollover] = useState(false);
  const [formYear, setFormYear] = useState(year);
  const [formMonth, setFormMonth] = useState(month);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);

  const activeCategories = categories.filter((c) => !c.isArchived);
  const selectedCategory = activeCategories.find((c) => c.id === categoryId);

  const createMutation = useMutation({
    mutationFn: (data: CreateBudgetDTO) => budgetsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); onSuccess(); },
    onError: (err: unknown) => {
      const msg = extractError(err);
      setFormError(msg.includes('409') || msg.toLowerCase().includes('conflict')
        ? 'A budget already exists for this period.'
        : msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!categoryId) return setFormError('Please select a category.');
    const parsed = Math.round(parseFloat(limitAmount) * 100);
    if (!limitAmount || isNaN(parsed) || parsed <= 0) return setFormError('Limit must be a positive amount.');
    createMutation.mutate({ categoryId, limitAmount: parsed, currency: 'PHP', year: formYear, month: formMonth, rollover });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
      {formError && (
        <p role="alert" className="rounded-xl bg-red-50/60 dark:bg-red-900/20 border border-red-200/60 px-3 py-2 text-sm text-red-600 dark:text-red-400">{formError}</p>
      )}

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Category <span className="text-red-400">*</span></label>
        <div className="relative">
          <button type="button" onClick={() => setCategoryOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={categoryOpen}
            className={`w-full flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${categoryId ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
            <span>{selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : 'Select a category…'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform shrink-0 ${categoryOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {categoryOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setCategoryOpen(false)} aria-hidden="true" />
              <ul role="listbox" aria-label="Category" className="absolute z-20 mt-1 w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/90 dark:bg-[#1a1a2e]/90 backdrop-blur-md shadow-lg max-h-52 overflow-y-auto py-1">
                {activeCategories.map((c) => (
                  <li key={c.id} role="option" aria-selected={c.id === categoryId}
                    onClick={() => { setCategoryId(c.id); setCategoryOpen(false); setFormError(null); }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none transition-colors ${c.id === categoryId ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'}`}>
                    <span aria-hidden="true">{c.icon}</span>{c.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Limit */}
      <div className="flex flex-col gap-1">
        <label htmlFor="budget-limit" className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Limit amount <span className="text-red-400">*</span></label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 dark:text-gray-500 select-none">PHP</span>
          <input id="budget-limit" type="number" min="0.01" step="0.01" value={limitAmount}
            onChange={(e) => setLimitAmount(e.target.value)} placeholder="0.00" required
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 pl-12 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
      </div>

      {/* Month / Year */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Month</label>
          <div className="relative">
            <button type="button" onClick={() => setMonthOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={monthOpen}
              className="w-full flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm text-gray-800 text-left focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors">
              <span>{MONTH_NAMES[formMonth - 1]}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform shrink-0 ${monthOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {monthOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMonthOpen(false)} aria-hidden="true" />
                <ul role="listbox" aria-label="Month" className="absolute z-20 mt-1 w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/90 dark:bg-[#1a1a2e]/90 backdrop-blur-md shadow-lg max-h-48 overflow-y-auto py-1">
                  {MONTH_NAMES.map((name, i) => (
                    <li key={i + 1} role="option" aria-selected={formMonth === i + 1}
                      onClick={() => { setFormMonth(i + 1); setMonthOpen(false); }}
                      className={`px-3 py-2 text-sm cursor-pointer select-none transition-colors ${formMonth === i + 1 ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'}`}>
                      {name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="budget-year" className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Year</label>
          <input id="budget-year" type="number" min={2020} max={2099} value={formYear}
            onChange={(e) => setFormYear(Number(e.target.value))}
            className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
      </div>

      {/* Rollover */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)}
          className="h-4 w-4 rounded border-black/10 text-indigo-600 focus:ring-indigo-400" />
        <span className="text-sm text-gray-600 dark:text-gray-300">Roll over unused budget to next month</span>
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={createMutation.isPending}
          className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors focus:outline-none">
          Cancel
        </button>
        <button type="submit" disabled={createMutation.isPending}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20">
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
      setDeleteErrors((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Failed to delete.' }));
      setDeletingId(null);
    },
  });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); } else { setMonth((m) => m - 1); }
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); } else { setMonth((m) => m + 1); }
  }

  const { data: budgets = [], isLoading: budgetsLoading, isError: budgetsError, refetch } = useQuery<Budget[]>({
    queryKey: ['budgets', year, month],
    queryFn: () => budgetsApi.list(year, month).then((r) => r.data),
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Month nav */}
        <div className={`flex items-center gap-1 ${glass} px-2 py-1.5`}>
          <button type="button" onClick={prevMonth}
            className="rounded-xl p-1.5 text-gray-500 dark:text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors focus:outline-none"
            aria-label="Previous month">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="min-w-[130px] text-center text-sm font-medium text-gray-700 dark:text-gray-200 select-none px-1">
            {formatMonthYear(year, month)}
          </span>
          <button type="button" onClick={nextMonth}
            className="rounded-xl p-1.5 text-gray-500 dark:text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors focus:outline-none"
            aria-label="Next month">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <button type="button" onClick={() => setShowForm(true)}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20">
          + Add Budget
        </button>
      </div>

      {/* Content */}
      {budgetsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><SkeletonCards /></div>
      ) : budgetsError ? (
        <div className={`${glass} px-6 py-10 text-center`}>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Failed to load budgets.</p>
          <button type="button" onClick={() => refetch()}
            className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none">
            Retry
          </button>
        </div>
      ) : budgets.length === 0 ? (
        <div className={`${glass} px-6 py-16 text-center border-dashed`}>
          <p className="text-sm text-gray-400 dark:text-gray-500">No budgets for {formatMonthYear(year, month)}.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} category={categoryMap.get(budget.categoryId)}
              onDelete={(id) => setDeletingId(id)} deleteError={deleteErrors[budget.id] ?? null} />
          ))}
        </div>
      )}

      {/* Add budget modal */}
      {showForm && (
        <div role="dialog" aria-modal="true" aria-label="Add budget" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowForm(false)} aria-hidden="true" />
          <div className="relative z-10 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl bg-white/80 dark:bg-white/[0.08] backdrop-blur-xl border border-white/70 dark:border-white/[0.08] shadow-2xl flex flex-col max-h-[calc(100dvh-env(safe-area-inset-top,16px))] sm:max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
              <div className="h-1 w-10 rounded-full bg-black/10 dark:bg-white/10" />
            </div>
            <div className="px-6 pt-4 pb-3 sm:pt-6 border-b border-black/[0.06] dark:border-white/[0.06]">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Add budget</h2>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-6">
              <BudgetForm categories={categories} year={year} month={month}
                onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingId && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-budget-title" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setDeletingId(null)} aria-hidden="true" />
          <div className={`relative z-10 w-full max-w-sm ${glass} p-6`}>
            <h2 id="delete-budget-title" className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">Delete budget?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">This will permanently remove the budget. Your expense records won't be affected.</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingId(null)} disabled={deleteMutation.isPending}
                className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors focus:outline-none">
                Cancel
              </button>
              <button type="button" onClick={() => deleteMutation.mutate(deletingId)} disabled={deleteMutation.isPending}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-40 transition-colors focus:outline-none">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
