import { AnimatePresence, motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';
import { useRotator } from '@/hooks/useRotator';

/** A single terminal-style line, cycling. `> ELECTRICAL: checking voltage…` */
export function Ticker() {
  const { theme, motionEnabled } = useVibe();
  const lines = theme.ticker ?? [];
  const { item, index } = useRotator(lines, { intervalMs: 4200 });

  if (!lines.length) return null;

  return (
    <div className="flex h-6 items-center gap-2 overflow-hidden">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      <div className="relative min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${theme.id}-${index}`}
            className="truncate font-mono text-xs text-muted"
            initial={motionEnabled ? { opacity: 0, y: 8 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={motionEnabled ? { opacity: 0, y: -8 } : { opacity: 0 }}
            transition={{ duration: 0.26 }}
          >
            {item}
          </motion.p>
        </AnimatePresence>
      </div>
      <span
        className={`h-3 w-[6px] shrink-0 bg-accent/70 ${motionEnabled ? 'vm-caret' : ''}`}
        aria-hidden="true"
      />
    </div>
  );
}
