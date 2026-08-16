import { useCallback, useEffect, useState } from 'react';
import { readStorage, writeStorage } from '@/utils/storage';

/**
 * `useState` that mirrors itself into localStorage. Reads happen lazily on
 * first render; writes are batched through an effect so a StrictMode double
 * render doesn't double-write.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => readStorage(key, initialValue));

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  const reset = useCallback(() => setValue(initialValue), [initialValue]);

  return [value, setValue, reset] as const;
}
