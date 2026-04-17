import { useEffect, useRef } from 'react';

interface Options {
  onRefresh: () => Promise<void> | void;
  /** px the user must pull down before release triggers refresh. Default 72 */
  threshold?: number;
  /** element to attach listeners to — defaults to window */
  scrollRef?: React.RefObject<HTMLElement | null>;
}

export function usePullToRefresh({ onRefresh, threshold = 72, scrollRef }: Options) {
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef?.current ?? window;
    let indicator: HTMLDivElement | null = null;

    function getScrollTop() {
      if (scrollRef?.current) return scrollRef.current.scrollTop;
      return window.scrollY;
    }

    function onTouchStart(e: Event) {
      const t = e as TouchEvent;
      if (getScrollTop() > 0) return; // only trigger when at top
      startY.current = t.touches[0].clientY;
      pulling.current = false;
    }

    function onTouchMove(e: Event) {
      const t = e as TouchEvent;
      if (startY.current === null) return;
      const delta = t.touches[0].clientY - startY.current;
      if (delta <= 0) { startY.current = null; return; }

      pulling.current = true;
      const progress = Math.min(delta / threshold, 1);

      // Create indicator lazily
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.style.cssText = [
          'position:fixed;top:0;left:50%;transform:translateX(-50%);',
          'z-index:9999;display:flex;align-items:center;justify-content:center;',
          'width:40px;height:40px;border-radius:50%;background:#6366f1;',
          'box-shadow:0 2px 8px rgba(0,0,0,.25);transition:opacity .15s;',
          'pointer-events:none;',
        ].join('');
        indicator.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.62"/></svg>`;
        document.body.appendChild(indicator);
        indicatorRef.current = indicator;
      }

      const translateY = Math.min(delta * 0.4, threshold * 0.6);
      indicator.style.transform = `translateX(-50%) translateY(${translateY}px) rotate(${progress * 360}deg)`;
      indicator.style.opacity = String(progress);
    }

    async function onTouchEnd() {
      if (!pulling.current || startY.current === null) { startY.current = null; return; }
      startY.current = null;
      pulling.current = false;

      if (indicator) {
        indicator.style.transition = 'opacity .2s,transform .2s';
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateX(-50%) translateY(0px)';
        setTimeout(() => { indicator?.remove(); indicator = null; indicatorRef.current = null; }, 200);
      }

      await onRefresh();
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      indicator?.remove();
    };
  }, [onRefresh, threshold, scrollRef]);
}
