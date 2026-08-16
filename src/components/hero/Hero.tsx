import { AnimatePresence, motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';

/** Kicker, title, subtitle for the active world. */
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

        <motion.h1
          {...rise(0.06)}
          // Sized against height as well as width — on a short window the
          // headline has to give ground so the scene below stays on screen.
          className="vm-glow-text mt-2 font-display text-[clamp(1.9rem,min(7vw,6.5vh),4.75rem)] leading-[0.94] font-bold text-ink lg:mt-3"
        >
          {theme.hero.title}
        </motion.h1>

        <motion.p
          {...rise(0.12)}
          className="vm-hide-short mt-3 max-w-lg text-base text-muted sm:text-lg"
        >
          {theme.hero.subtitle}
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
}
