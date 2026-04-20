import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletsApi } from '../lib/api';
import type { Wallet, CreateWalletDTO } from '@ledgr/types';
import { useSettings } from '../contexts/SettingsContext';
import { BrandLogo, getDomainFromLabel } from '../components/BrandLogo';
import BottomSheet from '../components/BottomSheet';
import { useAnimatedDelete } from '../hooks/useAnimatedDelete';

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';
const inputCls = 'w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors';

// ─── Wallet form ──────────────────────────────────────────────────────────────

function WalletForm({ wallet, onSuccess, onCancel }: {
  wallet?: Wallet;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const { currency: defaultCurrency } = useSettings();
  const isEdit = !!wallet;

  const [name, setName] = useState(wallet?.name ?? '');
  const [balance, setBalance] = useState(wallet ? String(wallet.balance / 100) : '');
  const [currency, setCurrency] = useState(wallet?.currency ?? defaultCurrency);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: CreateWalletDTO) =>
      isEdit
        ? walletsApi.update(wallet!.id, data)
        : walletsApi.create(data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['wallets'] });
      onSuccess();
    },
    onError: () => setError('Failed to save wallet.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Name is required.');
    const parsed = parseFloat(balance);
    if (balance === '' || isNaN(parsed)) return setError('Enter a valid balance.');
    mutation.mutate({
      name: name.trim(),
      balance: Math.round(parsed * 100),
      currency,
    });
  }

  // Live logo preview
  const hasBrand = getDomainFromLabel(name);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-1">
      {/* Live preview */}
      <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] px-4 py-3">
        {hasBrand
          ? <BrandLogo label={name} size={36} />
          : <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-white/90 border border-black/[0.07] text-lg">💳</span>
        }
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{name || 'Wallet name'}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{balance ? `${currency} ${parseFloat(balance || '0').toLocaleString()}` : 'Balance'}</p>
        </div>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="w-name" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Wallet name
        </label>
        <input id="w-name" type="text" maxLength={100} placeholder="e.g. GCash, BDO Savings"
          value={name} onChange={(e) => { setName(e.target.value); setError(''); }}
          className={inputCls} />
        {hasBrand && (
          <p className="mt-1 text-xs text-indigo-500 dark:text-indigo-400">✓ Logo detected</p>
        )}
      </div>

      {/* Balance */}
      <div>
        <label htmlFor="w-balance" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Current balance
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 select-none">{currency}</span>
          <input id="w-balance" type="number" inputMode="decimal" step="0.01" placeholder="0.00"
            value={balance} onChange={(e) => { setBalance(e.target.value); setError(''); }}
            className={`${inputCls} pl-12`} />
        </div>
      </div>

      {/* Currency */}
      <div>
        <label htmlFor="w-currency" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Currency</label>
        <select id="w-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}
          className={inputCls}>
          {['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'SGD'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {error && <p role="alert" className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={mutation.isPending}
          className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] disabled:opacity-40 transition-colors focus:outline-none">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add wallet'}
        </button>
      </div>
    </form>
  );
}

// ─── Wallet card ──────────────────────────────────────────────────────────────

function WalletCard({ wallet, onEdit, onDelete }: {
  wallet: Wallet;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { formatMoney } = useSettings();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNegative = wallet.balance < 0;

  return (
    <div className={`${glass} p-4 flex items-center gap-4 group`}>
      {getDomainFromLabel(wallet.name)
        ? <BrandLogo label={wallet.name} size={40} className="shrink-0" />
        : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-white/90 border border-black/[0.07] dark:border-white/[0.10] text-xl">
            💳
          </span>
      }

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{wallet.name}</p>
        <p className={`text-base font-bold tabular-nums mt-0.5 ${isNegative ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {isNegative ? `-${formatMoney(Math.abs(wallet.balance))}` : formatMoney(wallet.balance)}
        </p>
      </div>

      {confirmDelete ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">Delete?</span>
          <button type="button" onClick={onDelete}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors focus:outline-none">
            Yes
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 border border-black/10 dark:border-white/10 hover:bg-black/[0.04] transition-colors focus:outline-none">
            No
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={onEdit}
            className="rounded-lg p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 transition-colors focus:outline-none"
            aria-label={`Edit ${wallet.name}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors focus:outline-none"
            aria-label={`Delete ${wallet.name}`}>
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

export default function WalletsPage() {
  const { formatMoney } = useSettings();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Wallet | undefined>();

  const { data: wallets = [], isLoading, isError, refetch } = useQuery<Wallet[]>({
    queryKey: ['wallets'],
    queryFn: () => walletsApi.list().then((r) => r.data),
  });

  const { exitingIds, triggerDelete } = useAnimatedDelete(['wallets']);


  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

  function openEdit(w: Wallet) { setEditing(w); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(undefined); }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Accounts</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {wallets.length > 0
              ? `${wallets.length} account${wallets.length !== 1 ? 's' : ''} total`
              : 'Track your fund balances'}
          </p>
        </div>
        <button type="button" onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20">
          + Add
        </button>
      </div>

      {/* Total balance summary — only if 2+ */}
      {wallets.length > 1 && (
        <div className={`${glass} px-4 py-3.5 flex items-center justify-between`}>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Combined balance</p>
          <p className={`text-lg font-bold tabular-nums ${totalBalance < 0 ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>
            {formatMoney(totalBalance)}
          </p>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${glass} p-4 flex items-center gap-4`} aria-hidden="true">
              <div className="h-10 w-10 rounded-xl bg-black/[0.06] dark:bg-white/[0.06] animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-24 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
                <div className="h-4 w-20 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className={`${glass} px-6 py-10 text-center`}>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Failed to load wallets.</p>
          <button type="button" onClick={() => refetch()}
            className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] transition-colors focus:outline-none">
            Retry
          </button>
        </div>
      ) : wallets.length === 0 ? (
        <div className={`${glass} px-6 py-16 text-center border-dashed`}>
          <p className="text-2xl mb-3">💳</p>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No accounts yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Add GCash, bank accounts, or any fund source to track your balances.</p>
          <button type="button" onClick={() => setShowForm(true)}
            className="text-sm text-indigo-500 dark:text-indigo-400 hover:underline focus:outline-none">
            Add your first account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {wallets.map((w) => (
            <div key={w.id} className={exitingIds.has(w.id) ? 'item-exit' : 'item-enter'}>
              <WalletCard wallet={w}
                onEdit={() => openEdit(w)}
                onDelete={() => triggerDelete(w.id, () => walletsApi.delete(w.id))} />
            </div>
          ))}
        </div>
      )}

      <BottomSheet open={showForm} onClose={closeForm} title={editing ? 'Edit account' : 'Add account'}>
        <WalletForm wallet={editing} onSuccess={closeForm} onCancel={closeForm} />
      </BottomSheet>
    </div>
  );
}
