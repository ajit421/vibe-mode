import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';
import { backgroundImageFor } from '@/themes/backgrounds';

/**
 * The active mode's background picture, filling the window behind the
 * interface.
 *
 * The image is configured per mode in `.env` (see `themes/backgrounds.ts`) —
 * nothing about it lives in code. A mode with no image, or one whose image
 * fails to load, falls back to its colour gradient, which is a complete
 * background in its own right; there is never a broken frame.
 *
 * Two things make this read as a background rather than a picture:
 *
 *  - the scrim. A detailed image behind body copy destroys contrast, so the
 *    whole frame is knocked back evenly and the two fixed bars get a little
 *    more cover. The landing screen is damped much further — see below.
 *  - the feathered edges, so the image melts into the gradient instead of
 *    ending on a hard rectangle.
 */
export function SceneBackground() {
  const { theme, motionEnabled, hasEntered } = useVibe();
  const src = backgroundImageFor(theme.id);

  // A URL that 404s should degrade to the gradient, not to a broken image.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const showImage = Boolean(src) && !failed;

  return (
    // `z-0`, deliberately not a negative z-index. A child painted behind its
    // own positioned parent cannot be clicked *through* that parent, and the
    // interface above relies on this layer staying in normal stacking order.
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {showImage && (
          <motion.img
            key={`${theme.id}:${src}`}
            src={src ?? undefined}
            alt=""
            aria-hidden="true"
            decoding="async"
            onError={() => setFailed(true)}
            className="vm-scene object-cover"
            initial={motionEnabled ? { opacity: 0, scale: 1.02 } : { opacity: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>

      {/* An even tint across the whole frame, not a wash down one side.
          Sacrificing half the image to make one column readable is what made
          this look half-hidden; a uniform knock-back keeps every part of it
          equally visible and simply calms the whole thing.

          The landing screen is damped much further. Its headline and cards sit
          straight on the background with no panel of their own, and the image
          behind them is just whichever mode happens to be stored — arbitrary,
          and not worth costing the chooser its legibility. */}
      <div
        className="pointer-events-none absolute inset-0 transition-[background-color] duration-700"
        aria-hidden="true"
        style={{
          background: `color-mix(in oklab, var(--c-background) ${
            hasEntered ? (showImage ? 22 : 0) : 72
          }%, transparent)`,
        }}
      />

      {/* Only what the two fixed bars need. The text carries its own surface,
          so the image does not have to be dimmed into a readable backdrop. */}
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
