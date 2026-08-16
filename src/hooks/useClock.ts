import { useEffect, useState } from 'react';
import { usePageHidden } from './usePageVisibility';

/** A ticking clock that stops entirely while the tab is hidden. */
export function useClock(intervalMs = 1000): Date {
  const hidden = usePageHidden();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (hidden) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [hidden, intervalMs]);

  return now;
}
