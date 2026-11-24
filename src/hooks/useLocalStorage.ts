import { useCallback, useEffect, useRef, useState } from 'react';
import { readStorage, writeStorage } from '@/utils/storage';

/**
 * `useState` that mirrors itself into localStorage. Reads happen lazily on
 * first render; writes are batched through an effect so a StrictMode double
 * render doesn't double-write.
 *
 * `reconcile` runs once against the value read from storage, before it becomes
 * state. Use it when something more authoritative than the browser's memory —
 * a URL parameter, say — has to win on first load.
 *
 * `syncAcrossTabs` picks up writes from the site's other open tabs. Without it
 * each tab keeps its own copy, and the next write from a stale tab silently
 * puts back whatever it last saw — a listener customising in two tabs lost the
 * first tab's work. It is opt-in because some values are per tab on purpose
 * (the mode you are in shouldn't change because another tab moved). A synced
 * value goes through `reconcile` too, so it is checked like a stored one.
 * No ping-pong: the browser only fires `storage` when a value actually changes.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  reconcile?: (stored: T) => T,
  syncAcrossTabs = false,
) {
  const [value, setValue] = useState<T>(() => {
    const stored = readStorage(key, initialValue);
    return reconcile ? reconcile(stored) : stored;
  });

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  // Read through a ref so callers passing inline literals don't re-subscribe
  // the listener on every render.
  const latest = useRef({ initialValue, reconcile });
  latest.current = { initialValue, reconcile };

  useEffect(() => {
    if (!syncAcrossTabs) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || event.storageArea !== window.localStorage) return;
      const { initialValue: fallback, reconcile: check } = latest.current;
      const stored = readStorage(key, fallback);
      setValue(check ? check(stored) : stored);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, syncAcrossTabs]);

  const reset = useCallback(() => setValue(initialValue), [initialValue]);

  return [value, setValue, reset] as const;
}
