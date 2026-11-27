import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { X } from 'lucide-react';
import { useToast } from '@/state/toast-context';
import { IconButton } from './IconButton';
import { track } from '@/utils/analytics';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Wider layout for the mode picker. */
  size?: 'md' | 'lg';
}

/**
 * Every panel (Customize, Settings, shortcuts, the mode picker) is a native
 * modal `<dialog>`, opened with `showModal()`. The browser then does what this
 * used to hand-roll — a Tab trap, an Escape handler, locking the page — and
 * more: the page behind is inert for screen readers too, and Android's Back
 * gesture closes the panel instead of leaving the site.
 *
 * Opening and closing still go through React state, so Motion can animate
 * both ways: Escape/Back fire `cancel`, which is turned into `onClose`, and
 * the element is only closed (handing focus back to whatever opened it) once
 * the exit animation has finished and it unmounts.
 */
export function Modal(props: ModalProps) {
  return <AnimatePresence>{props.open && <ModalDialog {...props} />}</AnimatePresence>;
}

function ModalDialog({ onClose, title, description, children, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Callers pass an inline arrow, so `onClose` is new on every parent render
  // (the app shell re-renders ~2.5×/second while a track plays). Read it
  // through a ref so nothing here is keyed on it.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  /** Set while this component closes the dialog itself, so that `close` isn't reported back. */
  const closingHere = useRef(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    track('panel', title); // once per opening: this effect runs on mount only
    return () => {
      closingHere.current = true;
      if (dialog?.open) dialog.close();
    };
    // Mount only, on purpose: one count per opening, whatever the title does after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toasts sit behind a modal — dimmed on a desktop, hidden under the sheet on
  // a phone — so the feedback a panel's own buttons give ("Link copied",
  // "No room left…") shows in the panel instead. Only what happened since it
  // opened: an older toast here would read as a reply to nothing.
  const { toasts } = useToast();
  const [openedAfter] = useState(() => toasts.reduce((max, toast) => Math.max(max, toast.id), 0));
  const fresh = toasts.filter((toast) => toast.id > openedAfter);
  const latest = fresh[fresh.length - 1];

  return (
    <m.dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Escape or Back: let the exit animation run instead of vanishing.
        event.preventDefault();
        onCloseRef.current();
      }}
      // A close we didn't start: browsers may skip `cancel` for a repeated
      // Escape, closing the dialog outright — keep the app's state in step.
      onClose={() => {
        if (!closingHere.current) onCloseRef.current();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none items-end justify-center overflow-hidden border-0 bg-transparent p-0 text-ink open:flex sm:items-center sm:p-6"
    >
      <m.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => onCloseRef.current()}
      />
      <m.div
        // More opaque than the other frosted surfaces: a panel is for reading
        // and typing, so the busy picture behind should only just show through.
        className={`vm-panel relative w-full bg-surface/95 ${
          size === 'lg' ? 'sm:max-w-4xl' : 'sm:max-w-lg'
        } max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/60`}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line/70 bg-surface/85 px-5 py-4 backdrop-blur-md sm:px-6">
          <div>
            {/* h1: the page behind is inert, so this is the first heading in scope. */}
            <h1 id={titleId} className="font-display text-xl font-semibold tracking-tight text-ink">
              {title}
            </h1>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-sm text-muted">
                {description}
              </p>
            )}
            {/* Present from the start, so screen readers announce what fills it. */}
            <p role="status" className={latest ? 'mt-1.5 text-sm font-medium text-accent' : 'sr-only'}>
              {latest?.message ?? ''}
            </p>
          </div>
          <IconButton label="Close" size="sm" onClick={() => onCloseRef.current()} className="bg-ink/8">
            <X />
          </IconButton>
        </div>
        {/* On a phone the panel is a bottom sheet: its last controls must
            clear the home indicator, where a swipe belongs to the system. */}
        <div className="px-5 pt-5 pb-[calc(1.25rem+var(--safe-bottom))] sm:px-6 sm:pb-5">{children}</div>
      </m.div>
    </m.dialog>
  );
}
