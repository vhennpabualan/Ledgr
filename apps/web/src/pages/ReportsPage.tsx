import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, LineChart, Line,
  XAxis, YAxis, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { reportsApi } from '../lib/api';
import type { ReportSummary, TrendPoint } from '@ledgr/types';
import DatePicker, { todayISO } from '../components/DatePicker';
import { useSettings } from '../contexts/SettingsContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string { return todayISO(); }
function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const SLICE_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6',
  '#ec4899','#14b8a6','#f97316','#8b5cf6','#84cc16',
];

type GroupBy = 'category' | 'day' | 'week' | 'month';

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

function useIsDark() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function getTooltipStyle(isDark: boolean) {
  return {
    fontSize: 12,
    borderRadius: 12,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    background: isDark ? 'rgba(26,26,46,0.92)' : 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(8px)',
    color: isDark ? '#e5e7eb' : '#1f2937',
  };
}

// ─── Segment control ──────────────────────────────────────────────────────────

function SegmentControl<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: T[]; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="flex rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-0.5 gap-0.5" role="group" aria-label={label}>
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            aria-pressed={value === opt}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all duration-150 focus:outline-none',
              value === opt
                ? 'bg-white dark:bg-white/[0.08] text-gray-800 dark:text-gray-100 shadow-sm border border-black/[0.08] dark:border-white/[0.08]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            ].join(' ')}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function PieTooltipContent({ active, payload, isDark, formatMoney }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { percentage: number } }>; isDark?: boolean; formatMoney: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: extra } = payload[0];
  const style = getTooltipStyle(isDark ?? false);
  return (
    <div style={style} className="px-3 py-2 text-sm">
      <p className="font-medium text-gray-800 dark:text-gray-100">{name}</p>
      <p className="text-gray-600 dark:text-gray-300">{formatMoney(value)}</p>
      <p className="text-gray-400 dark:text-gray-500">{extra.percentage.toFixed(1)}%</p>
    </div>
  );
}

function LineTooltipContent({ active, payload, label, isDark, formatMoney }: { active?: boolean; payload?: Array<{ value: number }>; label?: string; isDark?: boolean; formatMoney: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  const style = getTooltipStyle(isDark ?? false);
  return (
    <div style={style} className="px-3 py-2 text-sm">
      <p className="font-medium text-gray-800 dark:text-gray-100">{label}</p>
      <p className="text-gray-600 dark:text-gray-300">{formatMoney(payload[0].value * 100)}</p>
    </div>
  );
}

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return <div className="w-full rounded-xl bg-black/[0.05] dark:bg-white/[0.05] animate-pulse" style={{ height }} aria-hidden="true" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { formatMoney } = useSettings();
  const [from, setFrom] = useState<string>(firstOfMonth);
  const [to, setTo] = useState<string>(today);
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [trendBy, setTrendBy] = useState<'day' | 'week' | 'month'>('day');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const isDark = useIsDark();

  async function handleExportCSV() {
    setExportLoading(true);
    setExportError(null);
    try {
      const response = await reportsApi.exportCSV({ from, to });
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ledgr-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  }

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery<ReportSummary>({
    queryKey: ['report-summary', from, to, groupBy],
    queryFn: () => reportsApi.getSummary({ from, to, groupBy }).then((r) => r.data),
  });

  const { data: trend, isLoading: trendLoading, isError: trendError } = useQuery<TrendPoint[]>({
    queryKey: ['report-trend', from, to, trendBy],
    queryFn: () => reportsApi.getTrend({ from, to, groupBy: trendBy }).then((r) => r.data),
  });

  const isError = summaryError || trendError;
  const pieData = (summary?.breakdown ?? []).map((b) => ({ name: b.categoryName, value: b.totalSpent, percentage: b.percentage }));
  const lineData = (trend ?? []).map((p) => ({ label: p.label, amount: p.totalSpent / 100 }));
  const hasData = (summary?.totalSpent ?? 0) > 0;

  return (
    <div className="space-y-5">

      {/* Filter + export bar */}
      <div className={`${glass} p-4`}>
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-end">
          <div className="flex items-center gap-2">
            <DatePicker id="report-from" label="From" value={from} onChange={setFrom} max={to || undefined} />
            <span className="text-gray-400 mt-5">–</span>
            <DatePicker id="report-to" label="To" value={to} onChange={setTo} min={from || undefined} align="right" />
          </div>

          <SegmentControl<GroupBy>
            label="Summary by"
            value={groupBy}
            onChange={setGroupBy}
            options={['category', 'day', 'week', 'month']}
          />

          {/* Export — sits in the filter bar */}
          <div className="flex flex-col items-start gap-1 sm:ml-auto">
            <button type="button" onClick={handleExportCSV} disabled={exportLoading}
              className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white/80 dark:hover:bg-white/[0.08] disabled:opacity-50 transition-colors focus:outline-none"
              aria-label="Export expenses as CSV">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              {exportLoading ? 'Exporting…' : 'Export CSV'}
            </button>
            {exportError && <p className="text-xs text-red-500 dark:text-red-400" role="alert">{exportError}</p>}
          </div>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className={`${glass} px-6 py-10 text-center`}>
          <p className="text-sm text-red-500 dark:text-red-400">Failed to load report data.</p>
        </div>
      )}

      {!isError && (
        <>
          {/* Summary card */}
          <div className={`${glass} p-6`}>
            {summaryLoading ? (
              <div className="space-y-3" aria-hidden="true">
                <div className="h-8 w-40 rounded-xl bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
                <div className="h-4 w-56 rounded-xl bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
                <div className="h-4 w-48 rounded-xl bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
              </div>
            ) : !hasData ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No data for this period.</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Total spent</p>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{formatMoney(summary!.totalSpent)}</p>
                </div>

                {summary!.breakdown.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Breakdown</p>
                    {/* All categories, scrollable if many */}
                    <ol className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {summary!.breakdown.map((b, i) => {
                        const pct = Math.min(b.percentage, 100);
                        return (
                          <li key={b.categoryId} className="space-y-1">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex items-center gap-2 text-gray-700 dark:text-gray-200 min-w-0">
                                <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }} aria-hidden="true" />
                                <span className="truncate">{b.categoryName}</span>
                              </span>
                              <span className="tabular-nums text-gray-800 dark:text-gray-100 font-medium shrink-0">
                                {formatMoney(b.totalSpent)}
                                <span className="ml-1.5 text-gray-400 dark:text-gray-500 font-normal text-xs">({b.percentage.toFixed(1)}%)</span>
                              </span>
                            </div>
                            {/* Mini progress bar per category */}
                            <div className="h-1 w-full rounded-full bg-black/[0.05] dark:bg-white/[0.05]">
                              <div className="h-1 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Charts */}
          {(summaryLoading || hasData) && (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Pie chart */}
              <div className={`${glass} p-6`}>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Category breakdown</p>
                {summaryLoading ? <ChartSkeleton /> : pieData.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-16 text-center">No data for this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        innerRadius={60} outerRadius={100} paddingAngle={2}>
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltipContent isDark={isDark} formatMoney={formatMoney} />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Line chart */}
              <div className={`${glass} p-6`}>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Spending trend</p>
                  <SegmentControl<'day' | 'week' | 'month'>
                    label=""
                    value={trendBy}
                    onChange={setTrendBy}
                    options={['day', 'week', 'month']}
                  />
                </div>
                {trendLoading ? <ChartSkeleton /> : lineData.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-16 text-center">No data for this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00000008" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                        tickFormatter={(v: number) => `₱${v.toLocaleString()}`} />
                      <Tooltip content={<LineTooltipContent isDark={isDark} formatMoney={formatMoney} />} />
                      <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2}
                        dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
