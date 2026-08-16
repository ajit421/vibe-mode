import type { CSSProperties } from 'react';
import { cn } from '@/utils/cn';

interface SliderProps {
  label: string;
  value: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  /** Human-readable position, e.g. `1:24 of 3:47`. */
  valueText?: string;
}

/**
 * A native range input in disguise — keeps keyboard support, screen-reader
 * semantics and touch dragging for free, with theme-coloured chrome.
 */
export function Slider({
  label,
  value,
  max,
  step = 1,
  disabled,
  onChange,
  className,
  valueText,
}: SliderProps) {
  const safeMax = max > 0 ? max : 1;
  const fill = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <input
      type="range"
      min={0}
      max={safeMax}
      step={step}
      value={Math.min(value, safeMax)}
      disabled={disabled}
      aria-label={label}
      aria-valuetext={valueText}
      onChange={(event) => onChange(Number(event.target.value))}
      className={cn('vm-range disabled:cursor-not-allowed disabled:opacity-40', className)}
      style={{ '--vm-fill': `${fill}%` } as CSSProperties}
    />
  );
}
