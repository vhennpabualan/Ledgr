import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringIncomeApi } from '../lib/api';
import type { RecurringIncome, CreateRecurringIncomeDTO, RecurringIncomeFrequency } from '@ledgr/types';
import { useSettings } from '../contexts/SettingsContext';
import BottomSheet from '../components/BottomSheet';
import { BrandLogo } from '../components/BrandLogo';

const glass =
  'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatFrequency(r: RecurringIncome): string {
  switch (r.frequency) {
    case 'weekly':
      return `Every ${DAYS[r.dayOfWeek ?? 0]}`;
    case 'biweekly':
      return `Every other ${DAYS[r.dayOfWeek ?? 0]}`;
    case 'monthly':
      return `Monthly on the ${ordinal(r.dayOfMonth ?? 1)}`;
    case 'yearly':
      return `Yearly on ${MONTHS[(r.monthOfYear ?? 1) - 1]} ${r.dayOfMonth}`;
  }
}

function formatNextDue(date: string): string {
  const d = new Date(date.slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return 'Overdue';
  if (diff < 7) return `${diff} days`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/[0.06] dark:bg-white/[0.06] ${className}`} />;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FormProps {
  item?: RecurringIncome;
  onSuccess: () => void;
  onCancel: () => void;
}

function RecurringIncomeForm({ item, onSuccess, onCancel }: FormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!item;

  // Derive the anchor day-of-week from the existing nextDueDate for biweekly
  const anchorDow = item?.dayOfWeek ?? new Date().getDay();

  const [form, setForm] = useState({
    label: item?.label ?? 'Salary',
    amount: item ? String(item.amount / 100) : '',
    currency: item?.currency ?? 'PHP',
    frequency: (item?.frequency ?? 'biweekly') as RecurringIncomeFrequency,
    dayOfWeek: String(anchorDow),
    dayOfMonth: String(item?.dayOfMonth ?? new Date().getDate()),
    monthOfYear: String(item?.monthOfYear ?? 1),
    startDate: item?.startDate ?? new Date().toISOString().slice(0, 10),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Preview next dates whenever frequency/startDate/dayOfWeek changes
  const { data: preview } = useQuery<{ dates: string[] }>({
    queryKey: ['recurring-income-preview', form.frequency, form.startDate, form.dayOfWeek],
    queryFn: () =>
      recurringIncomeApi
        .preview({
          frequency: form.frequency,
          startDate: form.startDate,
          dayOfWeek: ['weekly', 'biweekly'].includes(form.frequency)
            ? parseInt(form.dayOfWeek, 10)
            : undefined,
          count: 4,
        })
        .then((r) => r.data),
    enabled: !!form.startDate,
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: (data: CreateRecurringIncomeDTO) =>
      isEdit
        ? recurringIncomeApi.update(item.id, data).then((r) => r.data)
        : recurringIncomeApi.create(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['recurring-income'] });
      onSuccess();
    },
    onError: () => setErrors({ submit: 'Failed to save. Please try again.' }),
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    const num = parseFloat(form.amount);
    if (!form.amount || isNaN(num) || num <= 0) next.amount = 'Enter a valid amount.';
    if (!form.startDate) next.startDate = 'Start date is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const data: CreateRecurringIncomeDTO = {
      amount: Math.round(parseFloat(form.amount) * 100),
      currency: form.currency || 'PHP',
      label: form.label.trim() || 'Salary',
      frequency: form.frequency,
      startDate: form.startDate,
    };

    if (form.frequency === 'weekly' || form.frequency === 'biweekly') {
      data.dayOfWeek = parseInt(form.dayOfWeek, 10);
    }
    if (form.frequency === 'monthly' || form.frequency === 'yearly') {
      data.dayOfMonth = parseInt(form.dayOfMonth, 10);
    }
    if (form.frequency === 'yearly') {
      data.monthOfYear = parseInt(form.monthOfYear, 10);
    }

    mutation.mutate(data);
  }

  const inputCls = (hasError?: boolean) =>
    `w-full rounded-xl border px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors ${
      hasError
        ? 'border-red-300 bg-red-50/60 dark:bg-red-900/20'
        : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06]'
    }`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 pt-1">
      {/* Label */}
      <div>
        <label htmlFor="ri-label" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Label
        </label>
        <div className="flex items-center gap-2">
          <BrandLogo label={form.label || '?'} size={32} />
          <input
            id="ri-label"
            type="text"
            maxLength={100}
            placeholder="e.g. RCBC Salary"
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            className={`${inputCls()} flex-1`}
          />
        </div>
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="ri-amount" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">
            {form.currency}
          </span>
          <input
            id="ri-amount"
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

      {/* Frequency */}
      <div>
        <label htmlFor="ri-frequency" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Frequency
        </label>
        <select
          id="ri-frequency"
          value={form.frequency}
          onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as RecurringIncomeFrequency }))}
          className={inputCls()}
        >
          <option value="biweekly">Every 2 weeks (bi-weekly)</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      {/* Day of week (weekly / biweekly) */}
      {(form.frequency === 'weekly' || form.frequency === 'biweekly') && (
        <div>
          <label htmlFor="ri-dow" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Day of week
          </label>
          <select
            id="ri-dow"
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

      {/* Day of month (monthly / yearly) */}
      {(form.frequency === 'monthly' || form.frequency === 'yearly') && (
        <div>
          <label htmlFor="ri-dom" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Day of month
          </label>
          <select
            id="ri-dom"
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

      {/* Month of year (yearly) */}
      {form.frequency === 'yearly' && (
        <div>
          <label htmlFor="ri-moy" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Month
          </label>
          <select
            id="ri-moy"
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

      {/* Start date */}
      <div>
        <label htmlFor="ri-start" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          First payout date
        </label>
        <input
          id="ri-start"
          type="date"
          value={form.startDate}
          onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
          className={inputCls(!!errors.startDate)}
        />
        {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
      </div>

      {/* Preview */}
      {preview && preview.dates.length > 0 && (
        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-900/10 px-3 py-2.5">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1.5">Next payouts</p>
          <div className="flex flex-wrap gap-1.5">
            {preview.dates.map((d) => (
              <span
                key={d}
                className="rounded-lg bg-emerald-100/80 dark:bg-emerald-800/30 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300 tabular-nums"
              >
                {new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            ))}
          </div>
        </div>
      )}

      {errors.submit && (
        <p className="rounded-xl bg-red-50/60 dark:bg-red-900/20 border border-red-200/60 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {errors.submit}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={mutation.isPending}
          className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-500/20"
        >
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function RecurringIncomeRow({
  item,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: RecurringIncome;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { formatMoney } = useSettings();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`flex items-center gap-4 py-3 px-4 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 transition-opacity ${
        item.isPaused ? 'opacity-50' : ''
      }`}
    >
      <BrandLogo label={item.label} size={36} className="shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {formatFrequency(item)} · Next: {formatNextDue(item.nextDueDate)}
        </p>
      </div>

      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
        +{formatMoney(item.amount)}
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
              item.isPaused
                ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50/80 dark:hover:bg-amber-900/20'
                : 'text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
            }`}
            aria-label={item.isPaused ? 'Resume' : 'Pause'}
          >
            {item.isPaused ? 'Paused' : 'Active'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 transition-colors focus:outline-none"
            aria-label={`Edit ${item.label}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors focus:outline-none"
            aria-label={`Delete ${item.label}`}
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

export default function RecurringIncomePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringIncome | undefined>();

  const { data: items = [], isLoading, isError, refetch } = useQuery<RecurringIncome[]>({
    queryKey: ['recurring-income'],
    queryFn: () => recurringIncomeApi.list().then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPaused }: { id: string; isPaused: boolean }) =>
      recurringIncomeApi.update(id, { isPaused }),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['recurring-income'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recurringIncomeApi.delete(id),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['recurring-income'] }),
  });

  function openCreate() {
    setEditing(undefined);
    setShowForm(true);
  }

  function openEdit(item: RecurringIncome) {
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
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Recurring Income</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {activeCount > 0 ? `${activeCount} active` : 'No active recurring income'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm shadow-emerald-500/20"
        >
          + Add Income
        </button>
      </div>

      {/* List */}
      <div className={`${glass} overflow-hidden`}>
        {isLoading ? (
          <div className="divide-y divide-black/[0.05]">
            {Array.from({ length: 2 }).map((_, i) => (
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Failed to load recurring income.</p>
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
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">No recurring income yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Add your salary, freelance retainer, or any regular income.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="text-sm text-emerald-500 dark:text-emerald-400 hover:underline focus:outline-none"
            >
              Add your first one
            </button>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <RecurringIncomeRow
                key={item.id}
                item={item}
                onEdit={() => openEdit(item)}
                onToggle={() => toggleMutation.mutate({ id: item.id, isPaused: !item.isPaused })}
                onDelete={() => deleteMutation.mutate(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomSheet
        open={showForm}
        onClose={closeForm}
        title={editing ? 'Edit recurring income' : 'Add recurring income'}
      >
        <RecurringIncomeForm item={editing} onSuccess={closeForm} onCancel={closeForm} />
      </BottomSheet>
    </div>
  );
}
