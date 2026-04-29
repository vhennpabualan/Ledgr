import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { BalanceSummary, Wallet } from '@ledgr/types';
import { useSettings } from '../../contexts/SettingsContext';
import { BrandLogo } from '../BrandLogo';
import BottomSheet from '../BottomSheet';
import { incomeApi } from '../../lib/api';

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
  walletCount,
}: {
  active: 'bank' | 'wallets';
  onChange: (t: 'bank' | 'wallets') => void;
  walletCount: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Balance view"
      className="flex items-center gap-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-1"
    >
      <button
        role="tab"
        aria-selected={active === 'bank'}
        aria-controls="balance-panel-bank"
        id="balance-tab-bank"
        type="button"
        onClick={() => onChange('bank')}
        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          active === 'bank'
            ? 'bg-white dark:bg-white/[0.10] text-gray-800 dark:text-gray-100 shadow-sm'
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        Bank Balance
      </button>
      <button
        role="tab"
        aria-selected={active === 'wallets'}
        aria-controls="balance-panel-wallets"
        id="balance-tab-wallets"
        type="button"
        onClick={() => onChange('wallets')}
        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          active === 'wallets'
            ? 'bg-white dark:bg-white/[0.10] text-gray-800 dark:text-gray-100 shadow-sm'
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        E-Wallets
        {walletCount > 0 && (
          <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
            active === 'wallets'
              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
              : 'bg-black/[0.06] dark:bg-white/[0.08] text-gray-400'
          }`}>
            {walletCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ─── Add income sheet ─────────────────────────────────────────────────────────

function AddIncomeSheet({ year, month, onClose }: { year: number; month: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const inp = 'w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors';

  const mutation = useMutation({
    mutationFn: () => incomeApi.addEntry({
      amount: Math.round(parseFloat(amount) * 100),
      year,
      month,
      label: label.trim() || 'Income',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-entries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-balance'] });
      onClose();
    },
    onError: () => setError('Failed to add. Please try again.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) { setError('Enter a valid amount.'); return; }
    setError('');
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <div>
        <label htmlFor="ai-label" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Label</label>
        <input
          id="ai-label"
          type="text"
          maxLength={100}
          placeholder="e.g. Allowance, Bonus, Lottery"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={inp}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="ai-amount" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</label>
        <input
          id="ai-amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError(''); }}
          className={inp}
        />
      </div>
      {error && <p role="alert" className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors focus:outline-none shadow-sm shadow-emerald-500/20"
      >
        {mutation.isPending ? 'Adding…' : '+ Add income'}
      </button>
    </form>
  );
}

// ─── Bank balance panel ───────────────────────────────────────────────────────

interface BankPanelProps {
  balance: BalanceSummary;
  year: number;
  month: number;
}

function BankPanel({ balance, year, month }: BankPanelProps) {
  const { totalIncome, entries, totalSpent, remaining, remainingAfterPending, pendingTotal, percentSpent } = balance;
  const { formatMoney } = useSettings();
  const [expanded, setExpanded] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);

  const pct = Math.min(percentSpent, 100);
  const hasIncome = totalIncome > 0;
  const isOver = remaining < 0;
  const isOverAfterPending = remainingAfterPending < 0;

  const barColor = isOver
    ? 'bg-red-400'
    : percentSpent >= 80
    ? 'bg-amber-400'
    : 'bg-emerald-400';

  const remainingColor = isOver
    ? 'text-red-500 dark:text-red-400'
    : 'text-gray-800 dark:text-gray-100';

  return (
    <div
      role="tabpanel"
      id="balance-panel-bank"
      aria-labelledby="balance-tab-bank"
    >
      {/* Tappable collapsed view */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 pt-4 pb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
        aria-expanded={expanded}
        aria-controls="bank-detail"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Remaining balance
          </p>
          <div className="flex items-center gap-2">
            {hasIncome && entries.length > 0 && (
              <div className="flex items-center gap-1.5">
                {entries.slice(0, 3).map((e) => (
                  <BrandLogo key={e.id} label={e.label} size={28} />
                ))}
                {entries.length > 3 && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] dark:bg-white/[0.08] text-[10px] font-bold text-gray-500 dark:text-gray-400">
                    +{entries.length - 3}
                  </span>
                )}
              </div>
            )}
            <span className="text-gray-400 dark:text-gray-500">
              <ChevronIcon open={expanded} />
            </span>
          </div>
        </div>

        <p className={`text-4xl font-bold tabular-nums tracking-tight ${remainingColor}`}>
          {!hasIncome
            ? '—'
            : isOver
            ? `−${formatMoney(Math.abs(remaining))}`
            : formatMoney(remaining)
          }
        </p>

        {hasIncome && pendingTotal > 0 && (
          <p className={`text-sm mt-1 font-medium ${isOverAfterPending ? 'text-red-400 dark:text-red-500' : 'text-amber-500 dark:text-amber-400'}`}>
            {isOverAfterPending
              ? `−${formatMoney(Math.abs(remainingAfterPending))} after pending`
              : `${formatMoney(remainingAfterPending)} after pending`
            }
          </p>
        )}

        {!hasIncome && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Tap to add income and start tracking.
          </p>
        )}
      </button>

      {/* Progress bar */}
      {hasIncome && (
        <div className="h-1.5 w-full bg-black/[0.06] dark:bg-white/[0.06]">
          <div
            className={`h-full transition-all duration-700 ${barColor}`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(pct)}% of income spent`}
          />
        </div>
      )}

      {/* Expanded detail */}
      <div
        id="bank-detail"
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: expanded ? '600px' : '0px', opacity: expanded ? 1 : 0 }}
        aria-hidden={!expanded}
      >
        <div className="px-5 py-4 border-t border-black/[0.05] dark:border-white/[0.05] space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Income</p>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 tabular-nums">{formatMoney(totalIncome)}</p>
            </div>
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Spent</p>
              <p className={`text-sm font-bold tabular-nums ${isOver ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
                {formatMoney(totalSpent)}
              </p>
            </div>
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Used</p>
              <p className={`text-sm font-bold tabular-nums ${isOver ? 'text-red-500' : percentSpent >= 80 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {percentSpent.toFixed(0)}%
              </p>
            </div>
          </div>

          {pendingTotal > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-900/20 px-3 py-2.5">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending reserved</p>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatMoney(pendingTotal)}</p>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowAddIncome(true); }}
            className="w-full rounded-xl bg-emerald-600/10 dark:bg-emerald-500/10 border border-emerald-500/20 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/20 transition-colors focus:outline-none"
          >
            + Add income
          </button>
        </div>
      </div>

      <BottomSheet open={showAddIncome} onClose={() => setShowAddIncome(false)} title="Add income">
        <AddIncomeSheet year={year} month={month} onClose={() => setShowAddIncome(false)} />
      </BottomSheet>
    </div>
  );
}

// ─── E-Wallets panel ──────────────────────────────────────────────────────────

interface WalletsPanelProps {
  wallets: Wallet[];
}

function WalletsPanel({ wallets }: WalletsPanelProps) {
  const { formatMoney } = useSettings();
  const [expanded, setExpanded] = useState(false);

  const total = wallets.reduce((s, w) => s + w.balance, 0);
  const isNeg = total < 0;
  const hasWallets = wallets.length > 0;

  // Proportion bar colors
  const COLORS = [
    'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-sky-500', 'bg-violet-500', 'bg-rose-500',
  ];
  const absTotal = wallets.reduce((s, w) => s + Math.abs(w.balance), 0);

  return (
    <div
      role="tabpanel"
      id="balance-panel-wallets"
      aria-labelledby="balance-tab-wallets"
    >
      {/* Tappable collapsed view */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        disabled={!hasWallets}
        className="w-full text-left px-5 pt-4 pb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 disabled:cursor-default"
        aria-expanded={expanded}
        aria-controls="wallets-detail"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Total e-wallet balance
          </p>
          {hasWallets && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                {wallets.slice(0, 3).map((w) => (
                  <BrandLogo key={w.id} label={w.name} size={28} />
                ))}
                {wallets.length > 3 && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] dark:bg-white/[0.08] text-[10px] font-bold text-gray-500 dark:text-gray-400">
                    +{wallets.length - 3}
                  </span>
                )}
              </div>
              <span className="text-gray-400 dark:text-gray-500">
                <ChevronIcon open={expanded} />
              </span>
            </div>
          )}
        </div>

        <p className={`text-4xl font-bold tabular-nums tracking-tight ${
          !hasWallets
            ? 'text-gray-300 dark:text-gray-600'
            : isNeg
            ? 'text-red-500 dark:text-red-400'
            : 'text-gray-800 dark:text-gray-100'
        }`}>
          {!hasWallets
            ? '—'
            : isNeg
            ? `−${formatMoney(Math.abs(total))}`
            : formatMoney(total)
          }
        </p>

        {!hasWallets && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Add accounts on the Wallets page to track them here.
          </p>
        )}
      </button>

      {/* Proportion bar */}
      {hasWallets && absTotal > 0 && (
        <div className="h-1.5 w-full bg-black/[0.06] dark:bg-white/[0.06] flex overflow-hidden gap-px">
          {wallets.map((w, i) => (
            <div
              key={w.id}
              className={`h-full transition-all duration-700 ${COLORS[i % COLORS.length]}`}
              style={{ width: `${(Math.abs(w.balance) / absTotal) * 100}%` }}
              title={w.name}
            />
          ))}
        </div>
      )}

      {/* Expanded detail */}
      <div
        id="wallets-detail"
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: expanded ? '600px' : '0px', opacity: expanded ? 1 : 0 }}
        aria-hidden={!expanded}
      >
        <div className="px-5 py-4 border-t border-black/[0.05] dark:border-white/[0.05] space-y-4">
          {/* Per-wallet rows */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
              Accounts
            </p>
            <div className="space-y-2">
              {wallets.map((w, i) => {
                const wNeg = w.balance < 0;
                return (
                  <div key={w.id} className="flex items-center gap-2.5">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${COLORS[i % COLORS.length]}`} aria-hidden="true" />
                    <BrandLogo label={w.name} size={28} />
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate flex-1">{w.name}</span>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${wNeg ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
                      {wNeg ? `−${formatMoney(Math.abs(w.balance))}` : formatMoney(w.balance)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Accounts</p>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{wallets.length}</p>
            </div>
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Combined</p>
              <p className={`text-sm font-bold tabular-nums ${isNeg ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {isNeg ? `−${formatMoney(Math.abs(total))}` : formatMoney(total)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BalanceCard ──────────────────────────────────────────────────────────────

interface BalanceCardProps {
  balance: BalanceSummary;
  wallets: Wallet[];
  year: number;
  month: number;
}

export default function BalanceCard({ balance, wallets, year, month }: BalanceCardProps) {
  const [tab, setTab] = useState<'bank' | 'wallets'>('bank');

  return (
    <div className={`${glass} overflow-hidden`}>
      {/* Tab switcher */}
      <div className="px-4 pt-4">
        <TabBar active={tab} onChange={setTab} walletCount={wallets.length} />
      </div>

      {/* Panels */}
      {tab === 'bank'
        ? <BankPanel balance={balance} year={year} month={month} />
        : <WalletsPanel wallets={wallets} />
      }
    </div>
  );
}
