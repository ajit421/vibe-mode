import { AnimatePresence, motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';

/**
 * The ~900ms wipe between worlds: a coloured sweep in the *incoming* theme's
 * palette, carrying its name. Long enough to feel deliberate, short enough
 * that it never gets in the way.
 */
export function TransitionOverlay() {
  const { incomingTheme } = useVibe();

  return (
    <AnimatePresence>
      {incomingTheme && (
        <motion.div
          key={incomingTheme.id}
          className="pointer-events-none fixed inset-0 z-95 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          aria-hidden="true"
        >
          {/* Colour sweep across the screen. */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(100deg, ${incomingTheme.colors.background} 0%, ${incomingTheme.colors.backgroundAlt} 45%, ${incomingTheme.colors.background} 100%)`,
            }}
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.42, ease: [0.76, 0, 0.24, 1] }}
          />

          {/* Leading edge glow. */}
          <motion.div
            className="absolute inset-y-0 w-40"
            style={{
              background: `linear-gradient(90deg, transparent, ${incomingTheme.colors.primary}55, transparent)`,
              filter: 'blur(18px)',
            }}
            initial={{ x: '-30vw' }}
            animate={{ x: '110vw' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />

          <motion.div
            className="relative flex flex-col items-center gap-3 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: 0.16, duration: 0.3 }}
          >
            <span className="text-4xl sm:text-5xl" aria-hidden="true">
              {incomingTheme.emoji}
            </span>
            <span
              className="vm-label text-[0.7rem]"
              style={{ color: incomingTheme.colors.primary }}
            >
              Entering
            </span>
            <span
              className="font-display text-2xl font-semibold sm:text-3xl"
              style={{ color: incomingTheme.colors.text }}
            >
              {incomingTheme.name}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
