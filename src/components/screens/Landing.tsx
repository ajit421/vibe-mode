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
    // Centred inside the height it is given, never taller than it. The mode
    // rail keeps its own horizontal scroll on a phone — that is a sideways
    // gesture on a fixed screen, not the page scrolling.
    // `pointer-events-auto`: the landing is a full screen of interface, so it
    // takes clicks back from the scene behind it.
    <div className="pointer-events-auto mx-auto flex h-full max-w-[1600px] flex-col justify-center gap-1 overflow-hidden px-4 pt-16 pb-4 sm:px-6">
      <motion.p {...rise(0)} className="vm-label text-primary" style={{ letterSpacing: '0.24em' }}>
        Vibe Mode
      </motion.p>

      {/* `vh`-aware clamps: the headline and the gaps give ground on a short
          window so the mode cards below always stay on screen. */}
      <motion.h1
        {...rise(0.07)}
        className="vm-glow-text mt-2 max-w-4xl font-display text-[clamp(1.75rem,5.5vh,5rem)] leading-[0.95] font-bold text-ink sm:mt-3"
      >
        Where are you
        <br />
        right now?
      </motion.h1>

      <motion.p
        {...rise(0.14)}
        className="vm-hide-short mt-3 max-w-xl text-base text-muted sm:text-lg"
      >
        Pick the place. The site becomes it — colours, sounds, small details and a playlist that
        belongs there.
      </motion.p>

      <motion.div {...rise(0.2)} className="mt-5 min-h-0 shrink sm:mt-7">
        <ModePicker onSelect={enter} layout="rail" />
      </motion.div>

      <motion.p
        {...rise(0.32)}
        className="vm-hide-shorter mt-5 font-mono text-xs text-muted/80"
      >
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
