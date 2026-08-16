import { motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';
import { ModePicker } from '@/components/theme/ModePicker';

/** The first screen: one question, five answers. */
export function Landing() {
  const { enter, motionEnabled, themes } = useVibe();

  const rise = (delay: number) => ({
    initial: motionEnabled ? { opacity: 0, y: 20 } : { opacity: 0 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-[1600px] flex-col justify-center px-4 py-16 sm:px-6">
      <motion.p {...rise(0)} className="vm-label text-primary" style={{ letterSpacing: '0.24em' }}>
        Vibe Mode
      </motion.p>

      <motion.h1
        {...rise(0.07)}
        className="vm-glow-text mt-4 max-w-4xl font-display text-[clamp(2.25rem,7.5vw,5rem)] leading-[0.95] font-bold text-ink"
      >
        Where are you
        <br />
        right now?
      </motion.h1>

      <motion.p {...rise(0.14)} className="mt-5 max-w-xl text-base text-muted sm:text-lg">
        Pick the place. The site becomes it — colours, sounds, small details and a playlist that
        belongs there.
      </motion.p>

      <motion.div {...rise(0.2)} className="mt-10 sm:mt-12">
        <ModePicker onSelect={enter} layout="rail" />
      </motion.div>

      <motion.p {...rise(0.32)} className="mt-8 font-mono text-xs text-muted/80">
        Press <kbd className="rounded border border-line px-1.5 py-0.5">1</kbd>–
        <kbd className="rounded border border-line px-1.5 py-0.5">
          {Math.min(themes.length, 9)}
        </kbd>{' '}
        to jump straight in · <kbd className="rounded border border-line px-1.5 py-0.5">?</kbd> for
        shortcuts
      </motion.p>
    </div>
  );
}
