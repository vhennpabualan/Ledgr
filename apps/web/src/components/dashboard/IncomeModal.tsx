import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { incomeApi, recurringIncomeApi } from '../../lib/api';
import type { Income, RecurringIncome, RecurringIncomeFrequency, CreateRecurringIncomeDTO } from '@ledgr/types';
import { useSettings } from '../../contexts/SettingsContext';
import { BrandLogo } from '../BrandLogo';
import { useAnimatedDelete } from '../../hooks/useAnimatedDelete';

interface IncomeModalProps {
  year: number;
  month: number;
  onClose: () => void;
}

const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatSchedule(r: RecurringIncome): string {
  switch (r.frequency) {
    case 'weekly':    return `Every ${DAYS_SHORT[r.dayOfWeek ?? 0]}`;
    case 'biweekly':  return `Every other ${DAYS_SHORT[r.dayOfWeek ?? 0]}`;
    case 'monthly':   return `Monthly · ${ordinal(r.dayOfMonth ?? 1)}`;
    case 'yearly':    return `Yearly`;
  }
}

// ─── Recurring icon ───────────────────────────────────────────────────────────

function RecurringBadge() {
  return (
    <span
      title="Auto-generated from recurring schedule"
      className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      recurring
    </span>
  );
}

// ─── Shared input class ───────────────────────────────────────────────────────

const inp = 'w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors';

// ─── Add form ─────────────────────────────────────────────────────────────────

interface AddFormProps {
  year: number;
  month: number;
  onAdded: () => void;
}

function AddForm({ year, month, onAdded }: AddFormProps) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  // Recurring toggle state
  const [repeats, setRepeats] = useState(false);
  const [frequency, setFrequency] = useState<RecurringIncomeFrequency>('biweekly');
  const [dayOfWeek, setDayOfWeek] = useState(String(new Date().getDay())); // default today's weekday
  const [startDate, setStartDate] = useState(
    // Default to first occurrence in current month: find the next matching weekday from month start
    new Date(year, month - 1, 1).toISOString().slice(0, 10),
  );

  // Preview next dates when repeats is on
  const { data: preview } = useQuery<{ dates: string[] }>({
    queryKey: ['ri-preview', frequency, startDate, dayOfWeek],
    queryFn: () =>
      recurringIncomeApi
        .preview({ frequency, startDate, dayOfWeek: parseInt(dayOfWeek, 10), count: 3 })
        .then((r) => r.data),
    enabled: repeats && !!startDate,
    staleTime: 0,
  });

  const queryClient = useQueryClient();

  const addOnce = useMutation({
    mutationFn: () =>
      incomeApi.addEntry({
        amount: Math.round(parseFloat(amount) * 100),
        year,
        month,
        label: label.trim() || 'Income',
      }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['income-entries', year, month] });
      queryClient.refetchQueries({ queryKey: ['dashboard-balance'] });
      setLabel(''); setAmount(''); setError('');
      onAdded();
    },
    onError: () => setError('Failed to add entry.'),
  });

  const addRecurring = useMutation({
    mutationFn: () => {
      const dto: CreateRecurringIncomeDTO = {
        amount: Math.round(parseFloat(amount) * 100),
        label: label.trim() || 'Salary',
        frequency,
        startDate,
        dayOfWeek: ['weekly', 'biweekly'].includes(frequency) ? parseInt(dayOfWeek, 10) : undefined,
      };
      return recurringIncomeApi.create(dto);
    },
    onSuccess: async () => {
      // Process immediately so the entry appears in this month's list right away
      await recurringIncomeApi.process();
      queryClient.refetchQueries({ queryKey: ['income-entries', year, month] });
      queryClient.refetchQueries({ queryKey: ['recurring-income'] });
      queryClient.refetchQueries({ queryKey: ['dashboard-balance'] });
      setLabel(''); setAmount(''); setError(''); setRepeats(false);
      onAdded();
    },
    onError: () => setError('Failed to save schedule.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) { setError('Enter a valid amount.'); return; }
    if (repeats && !startDate) { setError('Pick a start date.'); return; }
    setError('');
    repeats ? addRecurring.mutate() : addOnce.mutate();
  }

  const isPending = addOnce.isPending || addRecurring.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Label + logo */}
      <div className="flex items-center gap-2">
        <BrandLogo label={label || '?'} size={32} />
        <input
          type="text"
          placeholder="Label (e.g. RCBC Salary, Freelance)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={100}
          className={`${inp} flex-1`}
        />
      </div>

      {/* Amount */}
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0.01"
        placeholder="0.00"
        value={amount}
        onChange={(e) => { setAmount(e.target.value); setError(''); }}
        className={inp}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />

      {/* Repeats toggle */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={repeats}
          onClick={() => setRepeats((r) => !r)}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
            repeats ? 'bg-indigo-600' : 'bg-black/20 dark:bg-white/20'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              repeats ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300">Repeats on a schedule</span>
      </label>

      {/* Schedule options — shown when repeats is on */}
      {repeats && (
        <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-900/10 p-3 space-y-2.5">
          {/* Frequency */}
          <div className="flex items-center gap-2">
            <label htmlFor="ri-freq" className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">Frequency</label>
            <select
              id="ri-freq"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurringIncomeFrequency)}
              className={`${inp} py-1.5`}
            >
              <option value="biweekly">Every 2 weeks</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Day of week (weekly / biweekly) */}
          {(frequency === 'weekly' || frequency === 'biweekly') && (
            <div className="flex items-center gap-2">
              <label htmlFor="ri-dow" className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">On</label>
              <select
                id="ri-dow"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className={`${inp} py-1.5`}
              >
                {DAYS_FULL.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* First payout date */}
          <div className="flex items-center gap-2">
            <label htmlFor="ri-start" className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">First date</label>
            <input
              id="ri-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`${inp} py-1.5`}
            />
          </div>

          {/* Preview chips */}
          {preview && preview.dates.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {preview.dates.map((d, i) => (
                <span
                  key={d}
                  className={`rounded-lg px-2 py-0.5 text-xs tabular-nums ${
                    i === 0
                      ? 'bg-indigo-100 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20"
      >
        {isPending ? '…' : repeats ? 'Save schedule' : 'Add'}
      </button>
    </form>
  );
}

// ─── Recurring schedule list ──────────────────────────────────────────────────

function ScheduleList() {
  const queryClient = useQueryClient();
  const { exitingIds, triggerDelete } = useAnimatedDelete(['recurring-income']);

  const { data: schedules = [], isLoading } = useQuery<RecurringIncome[]>({
    queryKey: ['recurring-income'],
    queryFn: () => recurringIncomeApi.list().then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPaused }: { id: string; isPaused: boolean }) =>
      recurringIncomeApi.update(id, { isPaused }),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['recurring-income'] }),
  });

  if (isLoading) return <div className="h-8 rounded-xl bg-black/[0.05] dark:bg-white/[0.05] animate-pulse" />;
  if (schedules.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Active schedules</p>
      {schedules.map((s) => (
        <div
          key={s.id}
          className={`flex items-center gap-2.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] px-3 py-2 ${s.isPaused ? 'opacity-50' : ''} ${exitingIds.has(s.id) ? 'item-exit' : 'item-enter'}`}
        >
          <BrandLogo label={s.label} size={28} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{s.label}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{formatSchedule(s)}</p>
          </div>
          <button
            type="button"
            onClick={() => toggleMutation.mutate({ id: s.id, isPaused: !s.isPaused })}
            className={`text-xs font-medium px-2 py-0.5 rounded-lg transition-colors focus:outline-none ${
              s.isPaused
                ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                : 'text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
            }`}
          >
            {s.isPaused ? 'Paused' : 'Active'}
          </button>
          <button
            type="button"
            onClick={() => triggerDelete(s.id, () => recurringIncomeApi.delete(s.id))}
            className="rounded-lg p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors focus:outline-none"
            aria-label={`Delete ${s.label} schedule`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function IncomeModal({ year, month, onClose }: IncomeModalProps) {
  const queryClient = useQueryClient();
  const { formatMoney } = useSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const { exitingIds, triggerDelete: triggerDeleteEntry } = useAnimatedDelete(['income-entries', year, month]);

  // Wrap to also refresh the balance card after an income entry is removed
  function deleteEntry(id: string) {
    triggerDeleteEntry(id, async () => {
      await incomeApi.deleteEntry(id);
      queryClient.refetchQueries({ queryKey: ['dashboard-balance'] });
    });
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Auto-process any due recurring income when modal opens
  useEffect(() => {
    recurringIncomeApi.process().then(() => {
      queryClient.refetchQueries({ queryKey: ['income-entries', year, month] });
      queryClient.refetchQueries({ queryKey: ['dashboard-balance'] });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: entries = [], isLoading } = useQuery<Income[]>({
    queryKey: ['income-entries', year, month],
    queryFn: () => incomeApi.listEntries(year, month).then((r) => r.data),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      incomeApi.patchEntry(id, {
        amount: Math.round(parseFloat(editAmount) * 100),
        label: editLabel.trim() || 'Income',
      }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['income-entries', year, month] });
      queryClient.refetchQueries({ queryKey: ['dashboard-balance'] });
      setEditingId(null);
    },
  });

  function startEdit(entry: Income) {
    setEditingId(entry.id);
    setEditLabel(entry.label);
    setEditAmount(String(entry.amount / 100));
  }

  const totalIncome = entries.reduce((s, e) => s + e.amount, 0);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="income-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-white/70 dark:border-white/[0.10] bg-white dark:bg-[#1a1a2e] shadow-2xl flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
          <div>
            <h2 id="income-modal-title" className="text-base font-semibold text-gray-800 dark:text-gray-100">
              Income sources
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {entries.length > 0 ? `Total this month: ${formatMoney(totalIncome)}` : 'Track your income for this month'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors focus:outline-none"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* This month's entries */}
          <div className="space-y-2">
            {isLoading ? (
              <>
                <div className="h-11 rounded-xl bg-black/[0.05] dark:bg-white/[0.05] animate-pulse" />
                <div className="h-11 rounded-xl bg-black/[0.05] dark:bg-white/[0.05] animate-pulse" />
              </>
            ) : entries.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3">
                No income entries for this month yet.
              </p>
            ) : entries.map((entry) =>
              editingId === entry.id ? (
                /* Inline edit */
                <div key={entry.id} className="item-enter flex items-center gap-2 rounded-xl border border-indigo-300/60 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-900/20 px-3 py-2">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    maxLength={100}
                    className="flex-1 min-w-0 rounded-lg border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.08] dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Label"
                  />
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    className="w-24 rounded-lg border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.08] dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => patchMutation.mutate({ id: entry.id })}
                    disabled={patchMutation.isPending}
                    className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors focus:outline-none"
                  >
                    {patchMutation.isPending ? '…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none focus:outline-none">×</button>
                </div>
              ) : (
                /* Display row */
                <div key={entry.id} className={`flex items-center gap-3 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] px-3 py-2.5 group ${exitingIds.has(entry.id) ? 'item-exit' : 'item-enter'}`}>
                  <BrandLogo label={entry.label} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{entry.label}</p>
                      {entry.recurringId && <RecurringBadge />}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                    {formatMoney(entry.amount)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!entry.recurringId && (
                      <button
                        type="button"
                        onClick={() => startEdit(entry)}
                        className="rounded-lg p-1 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 transition-colors focus:outline-none"
                        aria-label={`Edit ${entry.label}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry.id)}
                      className="rounded-lg p-1 text-gray-400 hover:text-red-500 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors focus:outline-none"
                      aria-label={`Delete ${entry.label}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Active recurring schedules */}
          <ScheduleList />

          {/* Divider */}
          <div className="h-px bg-black/[0.06] dark:bg-white/[0.06]" />

          {/* Add form */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Add income</p>
            <AddForm year={year} month={month} onAdded={() => {}} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
