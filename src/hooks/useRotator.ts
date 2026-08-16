import { useCallback, useEffect, useState } from 'react';
import { usePageHidden } from './usePageVisibility';

/**
 * Stable stand-in for a missing list. Passing a fresh `[]` on every render
 * would retrigger the reset effect below, so optional fields should fall back
 * to this instead of an inline literal.
 */
export const EMPTY_ITEMS: readonly string[] = [];

interface RotatorOptions {
  intervalMs?: number;
  /** Pause auto-advance (e.g. the user is hovering the quote). */
  paused?: boolean;
}

/**
 * Cycles through a list on a timer. Used by the quote rotator and the
 * terminal ticker. Restarts cleanly when the list changes (i.e. on a theme
 * switch) and never runs in a background tab.
 */
export function useRotator<T>(items: readonly T[], { intervalMs = 6500, paused }: RotatorOptions = {}) {
  const hidden = usePageHidden();
  const [index, setIndex] = useState(0);

  // A new theme means a new list — start from the top rather than keeping an
  // index that may now be out of range.
  useEffect(() => {
    setIndex(0);
  }, [items]);

  const next = useCallback(() => {
    setIndex((current) => (items.length ? (current + 1) % items.length : 0));
  }, [items.length]);

  useEffect(() => {
    if (paused || hidden || items.length < 2) return;
    const id = window.setInterval(next, intervalMs);
    return () => window.clearInterval(id);
  }, [paused, hidden, items.length, intervalMs, next]);

  const safeIndex = items.length ? index % items.length : 0;

  return {
    item: items.length ? items[safeIndex] : undefined,
    index: safeIndex,
    next,
    total: items.length,
  };
}
