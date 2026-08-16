import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { useVibe } from '@/state/vibe-context';
import { useRotator } from '@/hooks/useRotator';
import { IconButton } from '@/components/ui/IconButton';

/** One line of the mode's inner monologue, changing every few seconds. */
export function QuoteRotator() {
  const { theme, motionEnabled } = useVibe();
  const [paused, setPaused] = useState(false);
  const { item, next, index, total } = useRotator(theme.quotes, { intervalMs: 6500, paused });

  if (!total) return null;

  return (
    // `max-w-fit` keeps the refresh control tucked against the end of the
    // line. Left to fill the column it drifts off into the artwork and reads
    // as a stray icon belonging to nothing.
    <div
      className="flex max-w-fit items-start gap-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative min-h-14 flex-1 sm:min-h-16">
        <span aria-live="polite" className="sr-only">
          {item}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${theme.id}-${index}`}
            className="font-display text-xl leading-snug font-medium text-ink/90 sm:text-2xl"
            initial={motionEnabled ? { opacity: 0, y: 10 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={motionEnabled ? { opacity: 0, y: -8 } : { opacity: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
            aria-hidden="true"
          >
            <span className="text-primary">“</span>
            {item}
            <span className="text-primary">”</span>
          </motion.p>
        </AnimatePresence>
      </div>

      <IconButton
        label="Show another line"
        size="sm"
        onClick={next}
        className="pointer-events-auto mt-1"
      >
        <RefreshCw />
      </IconButton>
    </div>
  );
}
