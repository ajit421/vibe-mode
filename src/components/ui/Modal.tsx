import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Wider layout for the mode picker. */
  size?: 'md' | 'lg';
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Callers pass an inline arrow, so `onClose` is a new function on every
  // parent render. Reading it through a ref keeps the effect below keyed on
  // `open` alone — otherwise it tears down and re-runs on every render of the
  // app shell (which re-renders ~2.5×/second while a track is playing),
  // yanking focus back to the first control mid-keystroke.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape closes, Tab stays inside. Small hand-rolled trap — enough for two
  // simple dialogs and cheaper than pulling in a focus-management library.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      );
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {/* The wrapper must be a motion component: AnimatePresence only
          propagates exit animations through motion children. */}
      {open && (
        <m.div className="fixed inset-0 z-90 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <m.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className={`vm-panel relative w-full ${
              size === 'lg' ? 'sm:max-w-4xl' : 'sm:max-w-lg'
            } max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/60`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line/70 bg-surface/85 px-5 py-4 backdrop-blur-md sm:px-6">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-ink">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="mt-0.5 text-sm text-muted">
                    {description}
                  </p>
                )}
              </div>
              <IconButton label="Close" size="sm" onClick={onClose}>
                <X />
              </IconButton>
            </div>
            <div className="px-5 py-5 sm:px-6">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
