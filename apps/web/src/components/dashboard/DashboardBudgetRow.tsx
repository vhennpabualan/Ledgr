import { useQuery } from '@tanstack/react-query';
import { budgetsApi } from '../../lib/api';
import type { Budget, Category, BudgetStatus } from '@ledgr/types';
import { useSettings } from '../../contexts/SettingsContext';

interface DashboardBudgetRowProps {
  budget: Budget;
  category: Category | undefined;
}

export default function DashboardBudgetRow({ budget, category }: DashboardBudgetRowProps) {
  const { formatMoney, budgetAlertThreshold } = useSettings();
  const { data: status } = useQuery<BudgetStatus>({
    queryKey: ['budget-status', budget.id],
    queryFn: () => budgetsApi.getStatus(budget.id).then((r) => r.data),
    staleTime: 3 * 60 * 1000,
  });

  const spentPct = status ? Math.min((status.spent / budget.limitAmount) * 100, 100) : 0;
  const pendingPct = status ? Math.min((status.pending / budget.limitAmount) * 100, 100 - spentPct) : 0;
  const isOver = status?.isOverBudget ?? false;
  const isWarning = !isOver && spentPct >= budgetAlertThreshold;
  const barColor = isOver ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-indigo-500';

  return (
    <div className="py-2.5 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 space-y-1.5">
      {/* Top row: category + amounts */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          {category && (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs"
              style={{ backgroundColor: category.color + '22', color: category.color }}
              aria-hidden="true"
            >
              {category.icon}
            </span>
          )}
          <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{category?.name ?? '—'}</span>
          {isOver && <span className="shrink-0 text-[10px] font-bold text-red-500 dark:text-red-400">Over</span>}
          {isWarning && <span className="shrink-0 text-[10px]" aria-label="Budget warning">⚠️</span>}
        </div>
        <div className="shrink-0 text-right">
          {status ? (
            <span className={`text-xs font-semibold tabular-nums ${isOver ? 'text-red-500 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
              {formatMoney(status.spent)}
              <span className="font-normal text-gray-400 dark:text-gray-500"> / {formatMoney(budget.limitAmount)}</span>
            </span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">{formatMoney(budget.limitAmount)}</span>
          )}
        </div>
      </div>

      {/* Progress bar: indigo spent + amber pending */}
      {status ? (
        <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06] overflow-hidden flex">
          <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${spentPct}%` }} aria-hidden="true" />
          <div className="h-full bg-amber-300/70 transition-all duration-500" style={{ width: `${pendingPct}%` }} aria-hidden="true" />
        </div>
      ) : (
        <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
      )}
    </div>
  );
}
