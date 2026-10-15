import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every animation frame (plus a 250 ms interval for when frames are
 * throttled). Timers never count down a counter: they compare timestamps with this (brief §8).
 * Renders at most every 100 ms; recomputes immediately when the page becomes visible again.
 */
export function useNow(active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const update = () => {
      const t = Date.now();
      if (Math.floor(t / 100) !== Math.floor(last / 100)) {
        last = t;
        setNow(t);
      }
    };
    const frame = () => {
      update();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const iv = window.setInterval(update, 250);
    const onVisible = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active]);
  return now;
}

/** "1:30", "0:05", "12:00". */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
