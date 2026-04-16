import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { reportsApi } from '../lib/api';
import type { ReportSummary, TrendPoint } from '@ledgr/types';
import DatePicker, { todayISO } from '../components/DatePicker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPHP(minorUnits: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    currencyDisplay: 'symbol',
  }).format(minorUnits / 100);
}

function today(): string {
  return todayISO();
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Deterministic palette — cycles if more than 10 categories
const SLICE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#84cc16',
];

type GroupBy = 'category' | 'day' | 'week' | 'month';

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-xl bg-gray-100 animate-pulse"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

// ─── Custom tooltip for pie ───────────────────────────────────────────────────

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { percentage: number } }>;
}

function PieTooltipContent({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: extra } = payload[0];
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-gray-900">{name}</p>
      <p className="text-gray-600">{formatPHP(value)}</p>
      <p className="text-gray-400">{extra.percentage.toFixed(1)}%</p>
    </div>
  );
}

// ─── Custom tooltip for line ──────────────────────────────────────────────────

interface LineTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function LineTooltipContent({ active, payload, label }: LineTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-gray-900">{label}</p>
      <p className="text-gray-600">{formatPHP(payload[0].value * 100)}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [from, setFrom] = useState<string>(firstOfMonth);
  const [to, setTo] = useState<string>(today);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [trendBy, setTrendBy] = useState<'day' | 'week' | 'month'>('day');

  // ── Data ───────────────────────────────────────────────────────────────────

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery<ReportSummary>({
    queryKey: ['report-summary', from, to, groupBy],
    queryFn: () => reportsApi.getSummary({ from, to, groupBy }).then((r) => r.data),
  });

  // getTrend uses its own trendBy control — independent of the summary groupBy
  const {
    data: trend,
    isLoading: trendLoading,
    isError: trendError,
  } = useQuery<TrendPoint[]>({
    queryKey: ['report-trend', from, to, trendBy],
    queryFn: () => reportsApi.getTrend({ from, to, groupBy: trendBy }).then((r) => r.data),
  });

  const isLoading = summaryLoading || trendLoading;
  const isError = summaryError || trendError;

  // Pie data derived from summary breakdown
  const pieData = (summary?.breakdown ?? []).map((b) => ({
    name: b.categoryName,
    value: b.totalSpent,
    percentage: b.percentage,
  }));

  // Line data — convert minor units to pesos for Y axis
  const lineData = (trend ?? []).map((p) => ({
    label: p.label,
    amount: p.totalSpent / 100,
  }));

  const hasData = (summary?.totalSpent ?? 0) > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exportLoading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            aria-label="Export expenses as CSV"
          >
            {/* download icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            {exportLoading ? 'Exporting…' : 'Export CSV'}
          </button>
          {exportError && (
            <p className="text-xs text-red-500" role="alert">{exportError}</p>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap gap-4 items-end">
        <DatePicker
          id="report-from"
          label="From"
          value={from}
          onChange={setFrom}
          max={to || undefined}
        />
        <DatePicker
          id="report-to"
          label="To"
          value={to}
          onChange={setTo}
          min={from || undefined}
          align="right"
        />

        {/* Group by — controls the summary breakdown */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Summary by</span>
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5" role="group" aria-label="Group summary by">
            {(['category', 'day', 'week', 'month'] as GroupBy[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setGroupBy(opt)}
                className={[
                  'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all focus:outline-none focus:ring-2 focus:ring-gray-900',
                  groupBy === opt
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
                aria-pressed={groupBy === opt}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && !isLoading && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-6 py-10 text-center">
          <p className="text-sm text-red-600">Failed to load report.</p>
        </div>
      )}

      {/* Loading / content */}
      {!isError && (
        <>
          {/* Summary card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            {summaryLoading ? (
              <div className="space-y-3" aria-hidden="true">
                <div className="h-8 w-40 rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-56 rounded bg-gray-100 animate-pulse" />
                <div className="h-4 w-48 rounded bg-gray-100 animate-pulse" />
                <div className="h-4 w-52 rounded bg-gray-100 animate-pulse" />
              </div>
            ) : !hasData ? (
              <p className="text-sm text-gray-400">No data for this period.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Total spent</p>
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">
                    {formatPHP(summary!.totalSpent)}
                  </p>
                </div>

                {summary!.breakdown.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Top categories</p>
                    <ol className="space-y-1.5">
                      {summary!.breakdown.slice(0, 3).map((b, i) => (
                        <li key={b.categoryId} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2 text-gray-700">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
                              aria-hidden="true"
                            />
                            {b.categoryName}
                          </span>
                          <span className="tabular-nums text-gray-900 font-medium">
                            {formatPHP(b.totalSpent)}
                            <span className="ml-1.5 text-gray-400 font-normal">({b.percentage.toFixed(1)}%)</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Charts — only render when there's data */}
          {(summaryLoading || hasData) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pie / donut chart */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <p className="text-sm font-semibold text-gray-700 mb-4">Category breakdown</p>
                {summaryLoading ? (
                  <ChartSkeleton />
                ) : pieData.length === 0 ? (
                  <p className="text-sm text-gray-400 py-16 text-center">No data for this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {pieData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Line chart */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-gray-700">Spending trend</p>
                  {/* Trend grouping — independent of summary groupBy */}
                  <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5" role="group" aria-label="Trend group by">
                    {(['day', 'week', 'month'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTrendBy(opt)}
                        className={[
                          'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-all focus:outline-none focus:ring-2 focus:ring-gray-900',
                          trendBy === opt
                            ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                            : 'text-gray-500 hover:text-gray-700',
                        ].join(' ')}
                        aria-pressed={trendBy === opt}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                {trendLoading ? (
                  <ChartSkeleton />
                ) : lineData.length === 0 ? (
                  <p className="text-sm text-gray-400 py-16 text-center">No data for this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `₱${v.toLocaleString()}`}
                      />
                      <Tooltip content={<LineTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#6366f1' }}
                        activeDot={{ r: 5 }}
                      />
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
