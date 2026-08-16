import { Suspense, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';
import { getVisual } from '@/components/visuals/registry';

function VisualSkeleton() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-base-alt/40">
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
 * The big scene for the active mode. Each world is code-split, so switching
 * modes fetches only that world's artwork the first time you visit it.
 */
export function CentralVisual() {
  const { theme, motionEnabled } = useVibe();
  const Visual = useMemo(() => getVisual(theme.hero.visual), [theme.hero.visual]);

  return (
    <div className="relative w-full">
      {/* Bloom behind the frame, tinted by the theme. */}
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-60 blur-3xl"
        style={{
          background: `radial-gradient(60% 60% at 50% 45%, color-mix(in oklab, var(--c-glow) 30%, transparent), transparent 70%)`,
        }}
        aria-hidden="true"
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme.id}
          className="relative aspect-[10/7] w-full overflow-hidden rounded-2xl border border-line/80 bg-base shadow-2xl shadow-black/50"
          initial={motionEnabled ? { opacity: 0, scale: 0.985, filter: 'blur(6px)' } : { opacity: 0 }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={motionEnabled ? { opacity: 0, scale: 1.01, filter: 'blur(8px)' } : { opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<VisualSkeleton />}>
            <Visual />
          </Suspense>

          {/* Inner hairline for a bit of depth against the page. */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/6 ring-inset"
            aria-hidden="true"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
