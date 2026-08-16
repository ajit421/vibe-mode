import { useId } from 'react';
import { cn } from '@/utils/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className={cn('text-sm font-medium text-ink', disabled && 'opacity-50')}>
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          'disabled:cursor-not-allowed disabled:opacity-40',
          checked ? 'border-primary/60 bg-primary/30' : 'border-line bg-ink/8',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] size-4 rounded-full transition-all duration-200',
            checked ? 'left-[23px] bg-primary' : 'left-[3px] bg-muted',
          )}
        />
      </button>
    </div>
  );
}
