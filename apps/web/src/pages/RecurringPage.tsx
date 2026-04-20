import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringApi, categoriesApi } from '../lib/api';
import type { RecurringExpense, Category, CreateRecurringDTO } from '@ledgr/types';
import { useSettings } from '../contexts/SettingsContext';
import BottomSheet from '../components/BottomSheet';
import { BrandLogo, getDomainFromLabel } from '../components/BrandLogo';
import { useAnimatedDelete } from '../hooks/useAnimatedDelete';

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFrequency(r: RecurringExpense): string {
  switch (r.frequency) {
    case 'daily':
      return 'Every day';
    case 'weekly': {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `Every ${days[r.dayOfWeek ?? 0]}`;
    }
    case 'monthly': {
      const suffix = r.dayOfMonth === 1 || r.dayOfMonth === 21 || r.dayOfMonth === 31 ? 'st' :
                     r.dayOfMonth === 2 || r.dayOfMonth === 22 ? 'nd' :
                     r.dayOfMonth === 3 || r.dayOfMonth === 23 ? 'rd' : 'th';
      return `Monthly on the ${r.dayOfMonth}${suffix}`;
    }
    case 'yearly': {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `Yearly on ${months[(r.monthOfYear ?? 1) - 1]} ${r.dayOfMonth}`;
    }
    default:
      return r.frequency;
  }
}

function formatNextDue(date: string): string {
  // Strip time component if present (handles both 'YYYY-MM-DD' and ISO strings)
  const dateOnly = date.slice(0, 10);
  const d = new Date(dateOnly + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return 'Overdue';
  if (diff < 7) return `${diff} days`;

  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/[0.06] dark:bg-white/[0.06] ${className}`} />;
}

// ─── Recurring Form ───────────────────────────────────────────────────────────

interface RecurringFormProps {
  recurring?: RecurringExpense;
  onSuccess: () => void;
  onCancel: () => void;
}

function RecurringForm({ recurring, onSuccess, onCancel }: RecurringFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!recurring;
  
  const [form, setForm] = useState({
    amount: recurring ? String(recurring.amount / 100) : '',
    currency: recurring?.currency ?? 'PHP',
    categoryId: recurring?.categoryId ?? '',
    description: recurring?.description ?? '',
    frequency: recurring?.frequency ?? 'monthly',
    dayOfMonth: String(recurring?.dayOfMonth ?? new Date().getDate()),
    dayOfWeek: String(recurring?.dayOfWeek ?? 0),
    monthOfYear: String(recurring?.monthOfYear ?? 1),
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    staleTime: 30 * 60 * 1000,
  });
  
  const mutation = useMutation({
    mutationFn: (data: CreateRecurringDTO) =>
      isEdit
        ? recurringApi.update(recurring.id, data).then((r) => r.data)
        : recurringApi.create(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['recurring'] });
      onSuccess();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to save.';
      setErrors({ submit: message });
    },
  });
  
  function validate(): boolean {
    const next: Record<string, string> = {};
    const amountNum = parseFloat(form.amount);
    
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      next.amount = 'Amount must be greater than 0.';
    }
    if (!form.categoryId) {
      next.categoryId = 'Please select a category.';
    }
    
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    
    const data: CreateRecurringDTO = {
      amount: Math.round(parseFloat(form.amount) * 100),
      currency: form.currency || 'PHP',
      categoryId: form.categoryId,
      description: form.description.trim() || undefined,
      frequency: form.frequency as CreateRecurringDTO['frequency'],
    };
    
    if (form.frequency === 'monthly' || form.frequency === 'yearly') {
      data.dayOfMonth = parseInt(form.dayOfMonth, 10);
    }
    if (form.frequency === 'weekly') {
      data.dayOfWeek = parseInt(form.dayOfWeek, 10);
    }
    if (form.frequency === 'yearly') {
      data.monthOfYear = parseInt(form.monthOfYear, 10);
    }
    
    mutation.mutate(data);
  }
  
  const inputCls = (hasError?: boolean) =>
    `w-full rounded-xl border px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${
      hasError ? 'border-red-300 bg-red-50/60 dark:bg-red-900/20' : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06]'
    }`;
  
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 pt-1">
      {/* Amount */}
      <div>
        <label htmlFor="re-amount" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">{form.currency}</span>
          <input
            id="re-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            className={`${inputCls(!!errors.amount)} pl-12`}
          />
        </div>
        {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
      </div>
      
      {/* Category */}
      <div>
        <label htmlFor="re-category" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
        <select
          id="re-category"
          value={form.categoryId}
          onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
          className={inputCls(!!errors.categoryId)}
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        {errors.categoryId && <p className="mt-1 text-xs text-red-600">{errors.categoryId}</p>}
      </div>
      
      {/* Description */}
      <div>
        <label htmlFor="re-description" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Description <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="re-description"
          type="text"
          maxLength={500}
          placeholder="e.g. Netflix subscription"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          className={inputCls()}
        />
      </div>
      
      {/* Frequency */}
      <div>
        <label htmlFor="re-frequency" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frequency</label>
        <select
          id="re-frequency"
          value={form.frequency}
          onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as CreateRecurringDTO['frequency'] }))}
          className={inputCls()}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      
      {/* Day of month (for monthly/yearly) */}
      {(form.frequency === 'monthly' || form.frequency === 'yearly') && (
        <div>
          <label htmlFor="re-day" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Day of month
          </label>
          <select
            id="re-day"
            value={form.dayOfMonth}
            onChange={(e) => setForm((p) => ({ ...p, dayOfMonth: e.target.value }))}
            className={inputCls()}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}
      
      {/* Day of week (for weekly) */}
      {form.frequency === 'weekly' && (
        <div>
          <label htmlFor="re-dow" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Day of week
          </label>
          <select
            id="re-dow"
            value={form.dayOfWeek}
            onChange={(e) => setForm((p) => ({ ...p, dayOfWeek: e.target.value }))}
            className={inputCls()}
          >
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </div>
      )}
      
      {/* Month of year (for yearly) */}
      {form.frequency === 'yearly' && (
        <div>
          <label htmlFor="re-month" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Month
          </label>
          <select
            id="re-month"
            value={form.monthOfYear}
            onChange={(e) => setForm((p) => ({ ...p, monthOfYear: e.target.value }))}
            className={inputCls()}
          >
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      )}
      
      {errors.submit && (
        <p className="rounded-xl bg-red-50/60 dark:bg-red-900/20 border border-red-200/60 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {errors.submit}
        </p>
      )}
      
      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={mutation.isPending}
          className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-500/20">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ─── Recurring Row ─────────────────────────────────────────────────────────────

function RecurringRow({
  recurring,
  category,
  onEdit,
  onToggle,
  onDelete,
}: {
  recurring: RecurringExpense;
  category: Category | undefined;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { formatMoney } = useSettings();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`flex items-center gap-4 py-3 px-4 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 transition-opacity ${recurring.isPaused ? 'opacity-50' : ''}`}>
      {/* Brand logo if description matches, else category emoji squircle */}
      {recurring.description && getDomainFromLabel(recurring.description)
        ? <BrandLogo label={recurring.description} size={36} className="shrink-0" />
        : <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-white/90 border border-black/[0.07] dark:border-white/[0.10] shadow-sm shadow-black/[0.04] text-lg"
            aria-hidden="true"
          >
            {category?.icon ?? '🔁'}
          </span>
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
              {recurring.description || category?.name || 'Recurring expense'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {formatFrequency(recurring)} · Next: {formatNextDue(recurring.nextDueDate)}
            </p>
          </div>
        </div>
      </div>

      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums shrink-0">
        {formatMoney(recurring.amount)}
      </span>

      {confirmDelete ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">Delete?</span>
          <button
            type="button"
            onClick={() => { setConfirmDelete(false); onDelete(); }}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors focus:outline-none"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 border border-black/10 dark:border-white/10 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none"
          >
            No
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggle}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors focus:outline-none ${
              recurring.isPaused
                ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50/80 dark:hover:bg-amber-900/20'
                : 'text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
            }`}
            aria-label={recurring.isPaused ? 'Resume recurring expense' : 'Pause recurring expense'}
          >
            {recurring.isPaused ? 'Paused' : 'Active'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 transition-colors focus:outline-none"
            aria-label={`Edit ${recurring.description || category?.name || 'recurring expense'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors focus:outline-none"
            aria-label={`Delete ${recurring.description || category?.name || 'recurring expense'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | undefined>();
  
  const { data: items = [], isLoading, isError, refetch } = useQuery<RecurringExpense[]>({
    queryKey: ['recurring'],
    queryFn: () => recurringApi.list().then((r) => r.data),
  });
  
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    staleTime: 30 * 60 * 1000,
  });
  
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  
  const { exitingIds, triggerDelete } = useAnimatedDelete(['recurring']);

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPaused }: { id: string; isPaused: boolean }) =>
      recurringApi.toggle(id, isPaused),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['recurring'] }),
  });
  
  
  function openCreate() {
    setEditing(undefined);
    setShowForm(true);
  }
  
  function openEdit(item: RecurringExpense) {
    setEditing(item);
    setShowForm(true);
  }
  
  function closeForm() {
    setShowForm(false);
    setEditing(undefined);
  }
  
  const activeCount = items.filter((i) => !i.isPaused).length;
  
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Recurring Expenses</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {activeCount > 0 ? `${activeCount} active` : 'No active recurring expenses'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm shadow-indigo-500/20"
        >
          + Add
        </button>
      </div>
      
      {/* List */}
      <div className={`${glass} overflow-hidden`}>
        {isLoading ? (
          <div className="divide-y divide-black/[0.05]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 px-4">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Failed to load recurring expenses.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">No recurring expenses yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Add subscriptions, rent, or other regular bills.</p>
            <button type="button" onClick={openCreate}
              className="text-sm text-indigo-500 dark:text-indigo-400 hover:underline focus:outline-none">
              Add your first one
            </button>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <div key={item.id} className={exitingIds.has(item.id) ? 'item-exit' : 'item-enter'}>
                <RecurringRow
                  recurring={item}
                  category={categoryMap.get(item.categoryId)}
                  onEdit={() => openEdit(item)}
                  onToggle={() => toggleMutation.mutate({ id: item.id, isPaused: !item.isPaused })}
                  onDelete={() => triggerDelete(item.id, () => recurringApi.delete(item.id))}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Form modal */}
      <BottomSheet
        open={showForm}
        onClose={closeForm}
        title={editing ? 'Edit recurring expense' : 'Add recurring expense'}
      >
        <RecurringForm
          recurring={editing}
          onSuccess={closeForm}
          onCancel={closeForm}
        />
      </BottomSheet>
    </div>
  );
}
