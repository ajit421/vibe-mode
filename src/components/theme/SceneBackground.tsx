import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { useVibe } from '@/state/vibe-context';
import { usePageHidden } from '@/hooks/usePageVisibility';
import { backgroundFor, backgroundStillFor } from '@/themes/backgrounds';

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
  const tabHidden = usePageHidden();
  const background = backgroundFor(theme);
  const src = background?.url ?? null;
  const isVideo = background?.kind === 'video';

  // A URL that 404s should degrade to the gradient, not to a broken image.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * A looping clip is decorative motion like any other, so it follows the same
   * two rules the CSS keyframes do: it stops when the tab is in the background
   * (no point decoding frames nobody is looking at) and it stops when motion
   * is switched off, leaving a still frame rather than disappearing — the
   * artwork is still the artwork, it just holds position.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (motionEnabled && !tabHidden) {
      // Autoplay can still be refused; there is nothing to do about it here
      // and a paused first frame is a perfectly good background.
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [motionEnabled, tabHidden, src]);

  const showImage = Boolean(src) && !failed;
  // Shown under a video until its first frame paints, so the mode never
  // flashes an empty black rectangle on load.
  const poster = isVideo ? (backgroundStillFor(theme) ?? undefined) : undefined;

  return (
    // `z-0`, deliberately not a negative z-index. A child painted behind its
    // own positioned parent cannot be clicked *through* that parent, and the
    // interface above relies on this layer staying in normal stacking order.
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {showImage &&
          (isVideo ? (
            <m.video
              key={`${theme.id}:${src}`}
              ref={videoRef}
              src={src ?? undefined}
              poster={poster}
              // `muted` and `playsInline` are what make autoplay permissible at
              // all; without them the clip is a still on every mobile browser
              // and most desktop ones. `loop` is the whole point — these are
              // ten-second clips meant to run unnoticed.
              muted
              loop
              playsInline
              autoPlay={motionEnabled}
              preload="auto"
              aria-hidden="true"
              onError={() => setFailed(true)}
              className="vm-scene object-cover"
              initial={motionEnabled ? { opacity: 0, scale: 1.02 } : { opacity: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : (
            <m.img
              key={`${theme.id}:${src}`}
              src={src ?? undefined}
              alt=""
              aria-hidden="true"
              decoding="async"
              // The full-screen picture is the page's LCP; it shouldn't queue
              // behind the eight lazy card thumbnails. Lowercase and spread
              // because React 18 has no `fetchPriority` prop (React 19 does).
              {...{ fetchpriority: 'high' }}
              onError={() => setFailed(true)}
              className="vm-scene object-cover"
              initial={motionEnabled ? { opacity: 0, scale: 1.02 } : { opacity: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
      </AnimatePresence>

      {/* Inside a mode the artwork is left alone — no flat tint over it at all.
          It used to carry a 22% knock-back on top of a heavy top-and-bottom
          gradient *and* the top bar's own scrim, and three dimming layers
          stacked turned a bright picture into a murky one.

          The landing screen still gets damped, but less than before. Its
          headline sits straight on the background with no panel of its own,
          and the image behind it is just whichever mode happens to be stored,
          so legibility there is worth more than the picture. */}
      <div
        className="pointer-events-none absolute inset-0 transition-[background-color] duration-700"
        aria-hidden="true"
        style={{
          background: `color-mix(in oklab, var(--c-background) ${
            hasEntered ? 0 : 55
          }%, transparent)`,
        }}
      />

      {/* A whisper at the very top and bottom, and nothing in between.
          Everything that needs to stay readable already carries its own
          surface — the player bar is a blurred panel, the mode name has a
          text shadow — so this only has to stop the two edges from vibrating
          against a busy frame, not build a readable backdrop. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to bottom,' +
            ' color-mix(in oklab, var(--c-background) 30%, transparent) 0%,' +
            ' transparent 9%,' +
            ' transparent 88%,' +
            ' color-mix(in oklab, var(--c-background) 34%, transparent) 100%)',
        }}
      />
    </div>
  );
}
