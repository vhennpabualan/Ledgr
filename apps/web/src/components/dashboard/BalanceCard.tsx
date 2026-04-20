import { useState } from 'react';
import type { BalanceSummary } from '@ledgr/types';
import { useSettings } from '../../contexts/SettingsContext';
import { BrandLogo } from '../BrandLogo';

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
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
  const [hidden, setHidden] = useState(false);
  const pct = Math.min(percentSpent, 100);
  const hasIncome = totalIncome > 0;
  const isOver = remaining < 0;
  const isOverAfterPending = remainingAfterPending < 0;
  const barColor = isOver ? 'bg-red-400' : percentSpent >= 80 ? 'bg-amber-400' : 'bg-emerald-400';
  const mask = '••••••';

  return (
    <div className={`${glass} p-5`}>
      {/* Hero: Remaining balance */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Remaining balance</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHidden((h) => !h)}
              className="rounded-xl p-1.5 text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none"
              aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
            >
              <EyeIcon hidden={hidden} />
            </button>
            <button
              onClick={onEdit}
              className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
            >
              {hasIncome ? `${entries.length} source${entries.length !== 1 ? 's' : ''}` : 'Add income'}
            </button>
          </div>
        </div>
        <p className={`text-4xl font-bold mt-1 ${isOver ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
          {hasIncome
            ? (hidden ? mask : (isOver ? `-${formatMoney(Math.abs(remaining))}` : formatMoney(remaining)))
            : '—'}
        </p>
        {hasIncome && !hidden && pendingTotal > 0 && (
          <p className={`text-sm mt-0.5 font-medium ${isOverAfterPending ? 'text-red-400' : 'text-amber-500'}`}>
            {isOverAfterPending ? `-${formatMoney(Math.abs(remainingAfterPending))}` : formatMoney(remainingAfterPending)} after pending
          </p>
        )}
        {hasIncome && hidden && pendingTotal > 0 && (
          <p className="text-sm mt-0.5 font-medium text-amber-500">{mask} after pending</p>
        )}
      </div>

      {hasIncome ? (
        <>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="h-2 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
              <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${hidden ? 0 : pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
              <span>{hidden ? '–' : `${percentSpent.toFixed(1)}% spent`}</span>
              <span>{hidden ? '–' : `${(100 - pct).toFixed(1)}% left`}</span>
            </div>
          </div>

          {/* Income sources breakdown */}
          <div className="grid grid-cols-2 gap-3">
            {entries.length === 1 ? (
              <>
                <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-3 flex items-center gap-2">
                  <BrandLogo label={entries[0].label} size={28} />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5 truncate">{entries[0].label}</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{hidden ? mask : formatMoney(totalIncome)}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-3">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Spent</p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{hidden ? mask : formatMoney(totalSpent)}</p>
                </div>
              </>
            ) : (
              <>
                <div className="col-span-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-3 space-y-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500">{entries.length} income sources</p>
                  {entries.map((e) => (
                    <div key={e.id} className="flex items-center gap-2">
                      <BrandLogo label={e.label} size={24} />
                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">{e.label}</span>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 tabular-nums shrink-0">
                        {hidden ? mask : formatMoney(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-3">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Total income</p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{hidden ? mask : formatMoney(totalIncome)}</p>
                </div>
                <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-3">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Spent</p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{hidden ? mask : formatMoney(totalSpent)}</p>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">Add your income sources to track your monthly balance.</p>
      )}
    </div>
  );
}
