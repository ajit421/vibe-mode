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
      <div key={theme.id}>
        <motion.p
          {...rise(0)}
          className="vm-label text-primary/90"
          style={{ letterSpacing: '0.2em' }}
        >
          {theme.hero.kicker}
        </motion.p>

        <motion.h1
          {...rise(0.06)}
          className="vm-glow-text mt-3 font-display text-[clamp(2.5rem,7vw,4.75rem)] leading-[0.94] font-bold text-ink"
        >
          {theme.hero.title}
        </motion.h1>

        <motion.p {...rise(0.12)} className="mt-4 max-w-lg text-base text-muted sm:text-lg">
          {theme.hero.subtitle}
        </motion.p>
      </div>
    </AnimatePresence>
  );
}
