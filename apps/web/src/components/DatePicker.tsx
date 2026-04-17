import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  value: string;
  onChange: (iso: string) => void;
  label: string;
  min?: string;
  max?: string;
  showLabel?: boolean;
  className?: string;
  hasError?: boolean;
  align?: 'left' | 'right';
}

export default function DatePicker({
  id, value, onChange, label, min, max,
  showLabel = true, className = '', hasError = false, align = 'left',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

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

  // Position the portal popover relative to the trigger button
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 288; // w-72
    let left = align === 'right' ? rect.right - popoverWidth : rect.left;
    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));
    setPopoverStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left,
      width: popoverWidth,
      zIndex: 9999,
    });
  }, [open, align]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on scroll/resize
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
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

  const popover = open ? createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Pick ${label.toLowerCase()}`}
      style={popoverStyle}
      className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1a1a2e] shadow-2xl p-4"
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} aria-label="Previous month"
          className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors focus:outline-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {MONTH_NAMES[viewMonth - 1]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth} aria-label="Next month"
          className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors focus:outline-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
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
                'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400',
                selected  ? 'bg-indigo-600 text-white font-semibold' :
                disabled  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' :
                todayCell ? 'text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-black/[0.05] dark:hover:bg-white/[0.05]' :
                            'text-gray-700 dark:text-gray-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05]',
              ].join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative flex flex-col gap-1">
      {showLabel && (
        <label htmlFor={id} className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={showLabel ? undefined : label}
        className={[
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:border-gray-400 dark:hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-colors min-w-[148px]',
          hasError
            ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-gray-900 dark:text-gray-100'
            : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] text-gray-800 dark:text-gray-100',
          className,
        ].join(' ')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        <span>{formatDisplayDate(value)}</span>
      </button>

      {popover}
    </div>
  );
}
