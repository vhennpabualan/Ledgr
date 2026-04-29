import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi, categoriesApi, walletsApi } from '../lib/api';
import type { Expense, Category, Wallet } from '@ledgr/types';
import { useSettings } from '../contexts/SettingsContext';
import { BrandLogo, getDomainFromLabel } from '../components/BrandLogo';
import BottomSheet from '../components/BottomSheet';
import ExpenseForm from '../components/ExpenseForm';

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/[0.06] dark:bg-white/[0.06] ${className}`} />;
}

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatMoney } = useSettings();
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: expense, isLoading, isError } = useQuery<Expense>({
    queryKey: ['expense', id],
    queryFn: () => expensesApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const { data: wallets = [] } = useQuery<Wallet[]>({
    queryKey: ['wallets'],
    queryFn: () => walletsApi.list().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => expensesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-recent'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trend'] });
      navigate('/expenses', { replace: true });
    },
  });

  const category = categories.find((c) => c.id === expense?.categoryId);
  const wallet = expense?.walletId ? wallets.find((w) => w.id === expense.walletId) : null;

  if (isLoading) {
    return (
      <div className="space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-8" />
        </div>
        {/* Hero skeleton */}
        <Skeleton className="h-48" />
        {/* Details skeleton */}
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (isError || !expense) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none"
            aria-label="Back to expenses"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className={`${glass} p-8 text-center`}>
          <p className="text-sm text-red-500 dark:text-red-400">Failed to load expense.</p>
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="mt-3 text-sm text-indigo-500 dark:text-indigo-400 hover:underline focus:outline-none"
          >
            Back to expenses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/expenses')}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none"
          aria-label="Back to expenses"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-800 dark:text-gray-100">Expense</h1>
        <button
          type="button"
          onClick={() => setShowEdit(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none"
          aria-label="Edit expense"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
      </div>

      {/* Hero card */}
      <div className={`${glass} p-6 text-center`}>
        <div className="flex justify-center mb-4">
          {expense.description && getDomainFromLabel(expense.description) ? (
            <BrandLogo label={expense.description} size={64} />
          ) : (
            <span
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-white/90 border border-black/[0.07] dark:border-white/[0.10] shadow-sm text-3xl"
              aria-hidden="true"
            >
              {category?.icon ?? '💸'}
            </span>
          )}
        </div>
        <p className="text-4xl font-bold text-gray-900 dark:text-gray-50 tabular-nums mb-2">
          {formatMoney(expense.amount)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(expense.date)}</p>
      </div>

      {/* Details card */}
      <div className={`${glass} p-5 space-y-4`}>
        {/* Category */}
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Category</span>
          <div className="flex items-center gap-2 text-right">
            {category ? (
              <>
                <span className="text-lg" aria-hidden="true">{category.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{category.name}</span>
              </>
            ) : (
              <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
            )}
          </div>
        </div>

        {/* Paid from */}
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Paid from</span>
          <div className="text-right">
            {wallet ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20">
                <BrandLogo label={wallet.name} size={16} />
                {wallet.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
                🏦 Salary / Bank balance
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {expense.description && (
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Description</span>
            <p className="text-sm text-gray-700 dark:text-gray-200 text-right max-w-xs break-words">
              {expense.description}
            </p>
          </div>
        )}

        {/* Recurring */}
        {expense.recurringId && (
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Recurring</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Auto-created
            </span>
          </div>
        )}
      </div>

      {/* Receipt card */}
      {expense.receiptUrl && (
        <div className={`${glass} p-5`}>
          <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Receipt</h2>
          {/\.(jpe?g|png|gif|webp)$/i.test(expense.receiptUrl) ? (
            <a
              href={expense.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.08] hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <img
                src={expense.receiptUrl}
                alt="Receipt"
                className="w-full h-auto max-h-96 object-contain bg-white dark:bg-gray-900"
              />
            </a>
          ) : (
            <a
              href={expense.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              View receipt (PDF)
            </a>
          )}
        </div>
      )}

      {/* Danger zone */}
      <div className={`${glass} p-5`}>
        <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Danger zone</h2>
        {confirmDelete ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors focus:outline-none shadow-sm"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl border border-black/10 dark:border-white/10 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-50 transition-colors focus:outline-none"
              >
                Cancel
              </button>
            </div>
            {deleteMutation.isError && (
              <p className="text-xs text-red-500 dark:text-red-400">
                {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Failed to delete expense.'}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full rounded-xl border border-red-200/60 dark:border-red-500/20 bg-red-50/60 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100/80 dark:hover:bg-red-900/30 transition-colors focus:outline-none"
          >
            Delete expense
          </button>
        )}
      </div>

      {/* Edit modal */}
      <BottomSheet open={showEdit} onClose={() => setShowEdit(false)} title="Edit expense">
        <ExpenseForm
          expense={expense}
          onSuccess={() => {
            setShowEdit(false);
            queryClient.invalidateQueries({ queryKey: ['expense', id] });
          }}
          onCancel={() => setShowEdit(false)}
        />
      </BottomSheet>
    </div>
  );
}
