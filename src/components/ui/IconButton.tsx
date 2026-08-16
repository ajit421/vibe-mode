import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'ghost' | 'solid' | 'outline';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — these buttons are icon-only, so they need an accessible name. */
  label: string;
  size?: Size;
  variant?: Variant;
  /** Renders in the accent colour, e.g. shuffle when shuffle is on. */
  active?: boolean;
}

const SIZES: Record<Size, string> = {
  // Touch targets stay at least 40px even when the icon looks small.
  sm: 'h-9 w-9 [&_svg]:size-4',
  md: 'h-10 w-10 [&_svg]:size-[18px]',
  lg: 'h-12 w-12 [&_svg]:size-6',
};

const VARIANTS: Record<Variant, string> = {
  ghost: 'text-ink/70 hover:text-ink hover:bg-ink/8',
  outline: 'text-ink/80 border border-line hover:text-ink hover:border-primary/50',
  solid: 'bg-primary text-base hover:brightness-110 shadow-lg shadow-glow/25',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', variant = 'ghost', active, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'transition-[color,background-color,border-color,transform,filter] duration-200',
        'active:scale-95 disabled:pointer-events-none disabled:opacity-35',
        SIZES[size],
        VARIANTS[variant],
        active && variant !== 'solid' && 'text-accent bg-accent/12',
        className,
      )}
      {...props}
    />
  );
});
