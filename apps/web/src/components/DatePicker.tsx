import { useState, useRef, useEffect } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function todayISO(): string {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function formatDisplayDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── Component ────────────────────────────────────────────────────────────────

export interface DatePickerProps {
  id?: string;
  value: string;           // ISO "YYYY-MM-DD"
  onChange: (iso: string) => void;
  label: string;
  min?: string;
  max?: string;
  /** Show label above the trigger (default true) */
  showLabel?: boolean;
  /** Extra classes on the trigger button */
  className?: string;
  hasError?: boolean;
  /** Which edge of the trigger the popover aligns to (default 'left') */
  align?: 'left' | 'right';
}

export default function DatePicker({
  id,
  value,
  onChange,
  label,
  min,
  max,
  showLabel = true,
  className = '',
  hasError = false,
  align = 'left',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth() + 1);

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth() + 1);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startOffset = firstWeekday(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function selectDay(day: number) {
    onChange(toISO(viewYear, viewMonth, day));
    setOpen(false);
  }

  function isDayDisabled(day: number) {
    const iso = toISO(viewYear, viewMonth, day);
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  const isSelected = (day: number) => value === toISO(viewYear, viewMonth, day);
  const isToday    = (day: number) => todayISO() === toISO(viewYear, viewMonth, day);

  return (
    <div className="relative flex flex-col gap-1" ref={ref}>
      {showLabel && (
        <label htmlFor={id} className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={showLabel ? undefined : label}
        className={[
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors min-w-[148px]',
          hasError ? 'border-red-400 bg-red-50 text-gray-900' : 'border-gray-300 text-gray-900',
          className,
        ].join(' ')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        <span>{formatDisplayDate(value)}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Pick ${label.toLowerCase()}`}
          className={`absolute top-full mt-1 z-30 rounded-xl border border-gray-200 bg-white shadow-xl p-4 w-72 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} aria-label="Previous month"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} aria-label="Next month"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`blank-${i}`} />;
              const selected  = isSelected(day);
              const disabled  = isDayDisabled(day);
              const todayCell = isToday(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(day)}
                  aria-label={`${MONTH_NAMES[viewMonth - 1]} ${day}, ${viewYear}`}
                  aria-pressed={selected}
                  className={[
                    'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900',
                    selected  ? 'bg-gray-900 text-white font-semibold' :
                    disabled  ? 'text-gray-300 cursor-not-allowed' :
                    todayCell ? 'text-indigo-600 font-semibold hover:bg-gray-100' :
                                'text-gray-700 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
