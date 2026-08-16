import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { useVibe } from '@/state/vibe-context';
import { useRotator } from '@/hooks/useRotator';
import { subscribeVibeEvent } from '@/utils/events';
import { IconButton } from '@/components/ui/IconButton';

/**
 * The shortest time that may pass between two lines while the quote is pinned
 * on screen. Cursor movement is effectively continuous, so without a floor the
 * line would flicker through the whole list in a second.
 */
const QUIET_MS = 7000;

/** How long a line stays up when it has been summoned by a click. */
const FLASH_MS = 3000;

/**
 * One line of the mode's inner monologue.
 *
 * Two behaviours, chosen by the "Quotes" preference:
 *
 *   on    the line is pinned on screen. It does not cycle on a timer — a line
 *         changing by itself every few seconds pulls the eye back for no
 *         reason. It turns over when you poke the scene, and when you move the
 *         cursor, at most once per `QUIET_MS`.
 *
 *   off   (the default) nothing is shown. Clicking anywhere brings a line up
 *         for `FLASH_MS` and then it goes away again, so the writing is still
 *         there to find without being a permanent fixture over the artwork.
 */
export function QuoteRotator() {
  const { theme, motionEnabled, preferences } = useVibe();
  const pinned = preferences.quotes;

  // `paused` for good: every advance below is deliberate.
  const { item, next, index, total } = useRotator(theme.quotes, { paused: true });

  const nextRef = useRef(next);
  nextRef.current = next;

  const [flashing, setFlashing] = useState(false);
  const flashTimer = useRef<number | null>(null);

  // Starts "just advanced" so a pinned line stays long enough to be read
  // instead of being replaced by the first stray mouse movement.
  const lastAdvance = useRef(Date.now());

  const clearFlash = useCallback(() => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = null;
  }, []);

  useEffect(() => clearFlash, [clearFlash]);

  /** Show the next line. When not pinned, it is only up for a moment. */
  const reveal = useCallback(() => {
    lastAdvance.current = Date.now();
    nextRef.current();
    if (pinned) return;
    setFlashing(true);
    clearFlash();
    flashTimer.current = window.setTimeout(() => setFlashing(false), FLASH_MS);
  }, [pinned, clearFlash]);

  const revealRef = useRef(reveal);
  revealRef.current = reveal;

  // Poking the scene always counts, pinned or not.
  useEffect(() => subscribeVibeEvent('interact', () => revealRef.current()), []);

  // A click anywhere summons a line while the quote is not pinned.
  useEffect(() => {
    if (pinned) return;
    const onClick = () => revealRef.current();
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [pinned]);

  // While pinned, cursor movement turns the line over — rarely.
  useEffect(() => {
    if (!pinned) return;
    const onMove = () => {
      if (Date.now() - lastAdvance.current < QUIET_MS) return;
      revealRef.current();
    };
    // Passive: the handler only compares two timestamps and must never hold up
    // scrolling or pointer handling.
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [pinned]);

  // Switching the preference off mid-flash should not strand the line.
  useEffect(() => {
    if (pinned) {
      clearFlash();
      setFlashing(false);
    }
  }, [pinned, clearFlash]);

  const visible = total > 0 && (pinned || flashing);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="quote"
          // Its own surface, rather than a shared one in the layout: when this
          // is the only thing on screen, a panel that outlives it would sit
          // there as an empty box over the artwork.
          className="vm-panel pointer-events-auto flex max-w-full items-start gap-2 rounded-2xl px-5 py-4 sm:px-6 sm:py-5"
          initial={motionEnabled ? { opacity: 0, y: 10, scale: 0.99 } : { opacity: 0 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={motionEnabled ? { opacity: 0, y: 8, scale: 0.99 } : { opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative min-w-0">
            <span aria-live="polite" className="sr-only">
              {item}
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`${theme.id}-${index}`}
                className="font-display text-xl leading-snug font-medium text-ink/90 sm:text-2xl"
                initial={motionEnabled ? { opacity: 0, y: 8 } : { opacity: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={motionEnabled ? { opacity: 0, y: -6 } : { opacity: 0 }}
                transition={{ duration: 0.26, ease: 'easeOut' }}
                aria-hidden="true"
              >
                <span className="text-primary">“</span>
                {item}
                <span className="text-primary">”</span>
              </motion.p>
            </AnimatePresence>
          </div>

          {pinned && (
            <IconButton
              label="Show another line"
              size="sm"
              onClick={() => revealRef.current()}
              className="pointer-events-auto mt-0.5 shrink-0"
            >
              <RefreshCw />
            </IconButton>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
