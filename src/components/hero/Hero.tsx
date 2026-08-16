import { AnimatePresence, motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';

/**
 * The world's kicker and its scene line.
 *
 * The mode's name is not here — it is the `h1` in the top bar now. What is
 * left is the flavour: the ticket-stub kicker, and the line that describes
 * where you are. Repeating the name in both places just made the panel look
 * like a duplicate of the header.
 */
export function Hero() {
  const { theme, motionEnabled } = useVibe();

  const rise = (delay: number) => ({
    initial: motionEnabled ? { opacity: 0, y: 18 } : { opacity: 0 },
    animate: { opacity: 1, y: 0 },
    exit: motionEnabled ? { opacity: 0, y: -12 } : { opacity: 0 },
    transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <AnimatePresence mode="wait" initial={false}>
      {/* motion.div, not div — AnimatePresence needs a motion child to hold
          the exit animation open while the previous world fades out. */}
      <motion.div key={theme.id} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
        <motion.p
          {...rise(0)}
          className="vm-label text-primary/90"
          style={{ letterSpacing: '0.2em' }}
        >
          {theme.hero.kicker}
        </motion.p>

        <motion.p
          {...rise(0.06)}
          className="mt-2 max-w-lg font-display text-[clamp(1.05rem,2.1vw,1.5rem)] leading-snug font-medium text-ink"
        >
          {theme.hero.subtitle}
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
}
