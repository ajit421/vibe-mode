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
  const { theme, motionEnabled, hasEntered } = useVibe();
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

      {/* An even tint across the whole frame, not a wash down one side.
          Sacrificing half the artwork to make one column readable is what made
          the scene look half-hidden; a uniform knock-back keeps every part of
          it equally visible and simply calms the whole thing.

          The landing screen is damped much further. Its headline and cards sit
          straight on the background with no panel of their own, and the scene
          behind them is just whichever mode happens to be stored — arbitrary,
          and not worth costing the chooser its legibility. The mode cards carry
          their own previews, so nothing is lost by holding it back to a wash. */}
      <div
        className="pointer-events-none absolute inset-0 transition-[background-color] duration-700"
        aria-hidden="true"
        style={{
          background: `color-mix(in oklab, var(--c-background) ${hasEntered ? 18 : 72}%, transparent)`,
        }}
      />
      {/* Only what the two fixed bars need. The text carries its own surface
          (see `World`), so the scene does not have to be dimmed into a
          readable backdrop — which is what left half of it looking hidden. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to bottom,' +
            ' color-mix(in oklab, var(--c-background) 62%, transparent) 0%,' +
            ' color-mix(in oklab, var(--c-background) 8%, transparent) 12%,' +
            ' transparent 32%,' +
            ' transparent 62%,' +
            ' color-mix(in oklab, var(--c-background) 38%, transparent) 82%,' +
            ' color-mix(in oklab, var(--c-background) 78%, transparent) 100%)',
        }}
      />
    </div>
  );
}
