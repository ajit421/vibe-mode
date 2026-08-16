import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface HotspotProps {
  label: string;
  onActivate: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * A clickable region inside a scene SVG. Keyboard-reachable and labelled, so
 * the little easter eggs are not mouse-only.
 */
export function Hotspot({ label, onActivate, children, className }: HotspotProps) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      className={cn(
        'cursor-pointer origin-center transition-transform duration-200',
        'hover:brightness-125 focus-visible:brightness-125 active:scale-[0.97]',
        className,
      )}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onActivate();
      }}
    >
      <title>{label}</title>
      {children}
    </g>
  );
}
