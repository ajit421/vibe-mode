import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** The small outlined button the panels use for secondary actions. */
export const SMALL_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-primary/50 disabled:pointer-events-none disabled:opacity-40';

/**
 * A destructive button that asks twice: the first press arms it for a few
 * seconds, the second does it. Cheaper and calmer than a confirm dialog, and
 * it can't be dismissed on autopilot.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  icon,
  onConfirm,
  disabled,
  className,
}: {
  label: string;
  confirmLabel: string;
  icon: ReactNode;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(id);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      disabled={disabled}
      aria-label={armed ? confirmLabel : label}
      className={cn(SMALL_BUTTON, className, armed && 'border-primary/70 bg-primary/15 text-primary')}
    >
      {icon}
      {armed ? confirmLabel : label}
    </button>
  );
}
