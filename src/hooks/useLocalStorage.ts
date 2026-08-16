import { useCallback, useEffect, useState } from 'react';
import { readStorage, writeStorage } from '@/utils/storage';

/**
 * `useState` that mirrors itself into localStorage. Reads happen lazily on
 * first render; writes are batched through an effect so a StrictMode double
 * render doesn't double-write.
 *
 * `reconcile` runs once against the value read from storage, before it becomes
 * state. Use it when something more authoritative than the browser's memory —
 * a URL parameter, say — has to win on first load.
 */
export function useLocalStorage<T>(key: string, initialValue: T, reconcile?: (stored: T) => T) {
  const [value, setValue] = useState<T>(() => {
    const stored = readStorage(key, initialValue);
    return reconcile ? reconcile(stored) : stored;
  });

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  const reset = useCallback(() => setValue(initialValue), [initialValue]);

  return [value, setValue, reset] as const;
}
