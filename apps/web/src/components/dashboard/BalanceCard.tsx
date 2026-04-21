import { useState } from 'react';
import type { BalanceSummary } from '@ledgr/types';
import { useSettings } from '../../contexts/SettingsContext';
import { BrandLogo } from '../BrandLogo';

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

interface BalanceCardProps {
  balance: BalanceSummary;
  onEdit: () => void;
}

export default function BalanceCard({ balance, onEdit }: BalanceCardProps) {
  const { totalIncome, entries, totalSpent, remaining, remainingAfterPending, pendingTotal, percentSpent } = balance;
  const { formatMoney } = useSettings();
  const [expanded, setExpanded] = useState(false);

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
    <div className={`${glass} overflow-hidden`}>

      {/* ── Tappable collapsed view ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 pt-5 pb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
        aria-expanded={expanded}
        aria-controls="balance-detail"
      >
        {/* Label + chevron */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Remaining balance
          </p>
          <div className="flex items-center gap-2">
            {/* Income source logos — always visible, no amounts */}
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

        {/* Hero number */}
        <p className={`text-4xl font-bold tabular-nums tracking-tight ${remainingColor}`}>
          {!hasIncome
            ? '—'
            : isOver
            ? `−${formatMoney(Math.abs(remaining))}`
            : formatMoney(remaining)
          }
        </p>

        {/* Pending sub-line */}
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

      {/* Progress bar — full width, flush, always visible */}
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

      {/* ── Expanded detail panel ── */}
      <div
        id="balance-detail"
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: expanded ? '600px' : '0px', opacity: expanded ? 1 : 0 }}
        aria-hidden={!expanded}
      >
        <div className="px-5 py-4 border-t border-black/[0.05] dark:border-white/[0.05] space-y-4">
          {/* Income sources */}
          {hasIncome && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                Income sources
              </p>
              <div className="space-y-2">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-2.5">
                    <BrandLogo label={e.label} size={28} />
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate flex-1">{e.label}</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums shrink-0">
                      {formatMoney(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Income</p>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                {formatMoney(totalIncome)}
              </p>
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

          {/* Pending row */}
          {pendingTotal > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-900/20 px-3 py-2.5">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending reserved</p>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatMoney(pendingTotal)}</p>
            </div>
          )}

          {/* Edit income button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-full rounded-xl border border-black/10 dark:border-white/10 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none"
          >
            {hasIncome ? 'Edit income sources' : '+ Add income'}
          </button>
        </div>
      </div>
    </div>
  );
}
