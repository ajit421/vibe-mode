import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { useVibe } from '@/state/vibe-context';
import { useRotator } from '@/hooks/useRotator';
import { subscribeVibeEvent } from '@/utils/events';
import { IconButton } from '@/components/ui/IconButton';

/**
 * The shortest time that may pass between two lines. Cursor movement is
 * effectively continuous, so without a floor the line would flicker through the
 * whole list in a second.
 */
const QUIET_MS = 7000;

/**
 * One line of the mode's inner monologue.
 *
 * It does not cycle on a timer. A line changing on its own every few seconds
 * pulls the eye back over and over for no reason, and it is the one thing on a
 * still screen that never settles. Instead it answers to the room: poke
 * anything in the scene and it turns over, and moving the cursor turns it over
 * too — but no more often than `QUIET_MS`, so it reads as the page noticing
 * you rather than as an animation running.
 */
export function QuoteRotator() {
  const { theme, motionEnabled } = useVibe();
  // `paused` for good: every advance below is deliberate.
  const { item, next, index, total } = useRotator(theme.quotes, { paused: true });

  const nextRef = useRef(next);
  nextRef.current = next;

  // Starts "just advanced" so the first line stays put long enough to be read
  // instead of being replaced by the first stray mouse movement.
  const lastAdvance = useRef(Date.now());

  const advance = (force = false) => {
    const now = Date.now();
    if (!force && now - lastAdvance.current < QUIET_MS) return;
    lastAdvance.current = now;
    nextRef.current();
  };

  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(() => subscribeVibeEvent('interact', () => advanceRef.current(true)), []);

  useEffect(() => {
    const onMove = () => advanceRef.current();
    // Passive: the handler only compares two timestamps and must never hold up
    // scrolling or pointer handling. No visibility gate — a hidden tab receives
    // no pointer movement in the first place.
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  if (!total) return null;

  return (
    <div className="flex max-w-fit items-start gap-2">
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
        onClick={() => advance(true)}
        className="pointer-events-auto mt-1"
      >
        <RefreshCw />
      </IconButton>
    </div>
  );
}
