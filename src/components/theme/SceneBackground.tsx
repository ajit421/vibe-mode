import { Suspense, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';
import { getVisual } from '@/components/visuals/registry';

function SceneSkeleton() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex items-end gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className="w-1.5 rounded-full bg-primary/60"
            style={{
              height: 12 + (index % 3) * 14,
              animation: `vm-pulse ${0.9 + index * 0.12}s ease-in-out ${index * 0.08}s infinite`,
            }}
          />
        ))}
      </div>
      <span className="sr-only">Loading the scene…</span>
    </div>
  );
}

/**
 * The active mode's scene, filling the whole window behind the interface.
 *
 * Each world is code-split, so switching modes fetches only that world's
 * artwork the first time you visit it, and the two scenes cross-fade.
 *
 * Two things make this work as a background rather than a picture:
 *
 *  - it sits *above* the base gradient but below the ambient layers and the
 *    content, and it stays interactive — the per-mode hotspots are still
 *    clickable, which is why the layout above it lets clicks through where it
 *    has no controls of its own;
 *  - the scrim. A detailed illustration behind body copy destroys contrast, so
 *    the interface side of the screen is washed back toward the mode's own
 *    background colour. It fades bottom-up on a phone (text sits at the top)
 *    and left-to-right from `lg`, where the text column is on the left.
 */
export function SceneBackground() {
  const { theme, motionEnabled } = useVibe();
  const Visual = useMemo(() => getVisual(theme.hero.visual), [theme.hero.visual]);

  return (
    // `z-0`, deliberately not a negative z-index. A child painted behind its
    // own positioned parent cannot be clicked *through* that parent, so a
    // negative value here silently kills every hotspot in the scene.
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme.id}
          className="vm-scene pointer-events-auto"
          initial={motionEnabled ? { opacity: 0, scale: 1.03 } : { opacity: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<SceneSkeleton />}>
            <Visual />
          </Suspense>
        </motion.div>
      </AnimatePresence>

      {/* Readability scrim — see the note above. */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to bottom, var(--c-background) 0%, color-mix(in oklab, var(--c-background) 78%, transparent) 34%, color-mix(in oklab, var(--c-background) 30%, transparent) 62%, transparent 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to right, var(--c-background) 0%, var(--c-background) 24%, color-mix(in oklab, var(--c-background) 86%, transparent) 38%, color-mix(in oklab, var(--c-background) 40%, transparent) 54%, transparent 72%)',
        }}
      />
      {/* Keeps the player bar and the top bar sitting on something calm. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to bottom, color-mix(in oklab, var(--c-background) 55%, transparent) 0%, transparent 18%, transparent 74%, color-mix(in oklab, var(--c-background) 62%, transparent) 100%)',
        }}
      />
    </div>
  );
}
