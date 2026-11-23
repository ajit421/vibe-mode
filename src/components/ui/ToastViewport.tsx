import { AnimatePresence, m } from 'motion/react';
import { useToast } from '@/state/toast-context';

/**
 * Interaction feedback — "Jugaad mode activated", "Chai required", metro
 * announcements. Lives above the player bar so it never covers the controls.
 */
export function ToastViewport() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-70 flex flex-col items-center gap-2 px-4"
      style={{ bottom: 'calc(var(--player-height) + 16px)' }}
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <m.button
            key={toast.id}
            type="button"
            onClick={() => dismiss(toast.id)}
            className="vm-panel pointer-events-auto max-w-[min(92vw,30rem)] rounded-full px-4 py-2.5 text-left shadow-xl shadow-black/40"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <span className="flex items-center gap-2.5">
              {toast.tag && (
                <span className="vm-label shrink-0 text-accent">{toast.tag}</span>
              )}
              <span className="text-sm text-ink">{toast.message}</span>
            </span>
          </m.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
