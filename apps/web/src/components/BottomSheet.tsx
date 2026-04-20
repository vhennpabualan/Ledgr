import { useEffect, useRef, ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** aria-label for the dialog (defaults to title) */
  ariaLabel?: string;
}

/**
 * Mobile-first bottom sheet with drag-to-dismiss.
 * On sm+ screens it renders as a centered modal.
 */
export default function BottomSheet({ open, onClose, title, children, ariaLabel }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; currentY: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle open/close with animation
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      // Two rAFs: first lets the browser paint the initial off-screen position,
      // second triggers the transition into view.
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setIsVisible(true))
      );
      return () => cancelAnimationFrame(id);
    } else {
      setIsVisible(false);
      // Wait for exit animation before unmounting
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isVisible]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function onTouchStart(e: React.TouchEvent) {
    dragState.current = { startY: e.touches[0].clientY, currentY: e.touches[0].clientY };
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragState.current || !sheetRef.current) return;
    dragState.current.currentY = e.touches[0].clientY;
    const delta = Math.max(0, dragState.current.currentY - dragState.current.startY);
    sheetRef.current.style.transform = `translateY(${delta}px)`;
    sheetRef.current.style.transition = 'none';
  }

  function onTouchEnd() {
    if (!dragState.current || !sheetRef.current) return;
    const delta = dragState.current.currentY - dragState.current.startY;
    sheetRef.current.style.transition = '';
    if (delta > 80) {
      sheetRef.current.style.transform = 'translateY(100%)';
      setTimeout(onClose, 200);
    } else {
      sheetRef.current.style.transform = '';
    }
    dragState.current = null;
  }

  if (!shouldRender) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center ${!isVisible ? 'pointer-events-none' : ''}`}
    >
      {/* Backdrop */}
      <div
        className={[
          'absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={[
          'relative z-10 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl bg-white/80 dark:bg-white/[0.08] backdrop-blur-xl border border-white/70 dark:border-white/[0.08] shadow-2xl flex flex-col max-h-[calc(100dvh-env(safe-area-inset-top,16px))] sm:max-h-[85vh]',
          'transition-transform duration-300 ease-out',
          isVisible ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        style={{ willChange: 'transform' }}
      >
        {/* Drag handle — touch target */}
        <div
          className="flex justify-center pt-3 pb-1 sm:hidden cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          aria-hidden="true"
        >
          <div className="h-1 w-10 rounded-full bg-black/10 dark:bg-white/10" />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-3 sm:pt-6 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-6 pt-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
