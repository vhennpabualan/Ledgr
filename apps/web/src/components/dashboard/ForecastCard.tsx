import type { TrendPoint } from '@ledgr/types';
import { useSettings } from '../../contexts/SettingsContext';

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

function dayOfMonth(): number {
  return new Date().getDate();
}

function daysInCurrentMonth(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

interface ForecastCardProps {
  trend: TrendPoint[] | undefined;
  income: number | null;
}

export default function ForecastCard({ trend, income }: ForecastCardProps) {
  const { formatMoney } = useSettings();

  if (!trend || trend.length === 0) return null;

  const currentDay = dayOfMonth();
  const totalDays = daysInCurrentMonth();
  const daysLeft = totalDays - currentDay;

  // Sum only days that have data
  const totalSpentSoFar = trend.reduce((sum, p) => sum + p.totalSpent, 0);
  // Average per elapsed day
  const avgPerDay = currentDay > 0 ? totalSpentSoFar / currentDay : 0;
  const projectedTotal = totalSpentSoFar + avgPerDay * daysLeft;

  const overIncome = income !== null && projectedTotal > income;
  const projectedOverBy = income !== null ? projectedTotal - income : 0;

  // Only show if we have at least 3 days of data
  if (currentDay < 3) return null;

  return (
    <div className={`${glass} p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Month-end forecast</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Based on your average of {formatMoney(Math.round(avgPerDay))}/day over {currentDay} days
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 bg-black/[0.04] dark:bg-white/[0.04] rounded-lg px-2 py-1">
          {daysLeft}d left
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-3">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Spent so far</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{formatMoney(totalSpentSoFar)}</p>
        </div>
        <div className={`rounded-xl p-3 ${overIncome ? 'bg-red-50/60 dark:bg-red-900/20' : 'bg-indigo-50/60 dark:bg-indigo-900/20'}`}>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Projected total</p>
          <p className={`text-sm font-semibold tabular-nums ${overIncome ? 'text-red-500 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
            {formatMoney(Math.round(projectedTotal))}
          </p>
        </div>
      </div>

      {/* Insight line */}
      {income !== null && (
        <p className={`mt-3 text-xs font-medium ${overIncome ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {overIncome
            ? `At this rate you'll exceed your income by ${formatMoney(Math.round(projectedOverBy))}.`
            : `You're on track to stay ${formatMoney(Math.round(income - projectedTotal))} under your income.`}
        </p>
      )}
    </div>
  );
}
