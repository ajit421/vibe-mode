import { AnimatePresence, motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';

/**
 * The base gradient for the active world. Cross-fades on theme change rather
 * than transitioning `background-image`, which browsers cannot interpolate.
 */
export function ThemeBackground() {
  const { theme } = useVibe();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-base">
      <AnimatePresence initial={false}>
        <motion.div
          key={theme.id}
          className="absolute inset-0"
          style={{ backgroundImage: theme.background.gradient }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      {theme.background.overlay && theme.background.overlay !== 'none' && (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: theme.background.overlay }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
