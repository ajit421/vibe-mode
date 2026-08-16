import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type Toast } from './toast-context';

const VISIBLE_MS = 2800;
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, tag?: string) => {
      setToasts((current) => {
        // Re-tapping the same hotspot should feel like one toast refreshing,
        // not a pile of identical ones.
        const existing = current.find((toast) => toast.message === message);
        if (existing) {
          const timer = timers.current.get(existing.id);
          if (timer) window.clearTimeout(timer);
          timers.current.set(
            existing.id,
            window.setTimeout(() => dismiss(existing.id), VISIBLE_MS),
          );
          return current;
        }

        const id = nextId.current++;
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), VISIBLE_MS),
        );
        return [...current, { id, message, tag }].slice(-MAX_VISIBLE);
      });
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
