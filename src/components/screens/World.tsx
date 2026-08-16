import { Hero } from '@/components/hero/Hero';
import { QuoteRotator } from '@/components/hero/QuoteRotator';
import { StatsPanel } from '@/components/hero/StatsPanel';
import { PlaylistChips } from '@/components/player/PlaylistChips';
import { StatusBar } from '@/components/layout/StatusBar';

/**
 * The active mode, once you're inside it.
 *
 * The scene is no longer a panel in this layout — it fills the window behind
 * everything (see `SceneBackground`). What is left here is the interface that
 * reads on top of it, held to the left half from `lg` so the artwork stays
 * visible, and to the upper area on a phone where the scrim is strongest.
 *
 * The wrappers are `pointer-events-none` so a click on empty space falls
 * through to the scene's hotspots behind; each actual control turns pointer
 * events back on. Without that the layout would swallow every easter egg.
 *
 * This screen never scrolls — it is sized to whatever height the shell gives
 * it, and the optional blocks drop out under the `vm-hide-short` threshold
 * rather than being squashed.
 */
export function World() {
  return (
    <div className="pointer-events-none mx-auto flex h-full max-w-[1600px] flex-col gap-3 px-4 pt-14 pb-2 sm:px-6 sm:pt-16 lg:gap-4 lg:pt-20">
      <div className="flex min-h-0 flex-1 flex-col justify-start gap-3 lg:justify-center">
        {/* A fixed measure, not a percentage: the column has to stay inside the
            opaque part of the scrim, and a percentage of a very wide window
            walks straight out of it. */}
        <div className="flex min-w-0 flex-col gap-2.5 lg:max-w-[34rem] lg:gap-4">
          {/* Nothing here re-enables pointer events at block level — the text
              is not interactive, and a transparent box over the scene would
              block its hotspots. The controls inside the quote row and the
              playlist chips opt themselves back in. */}
          <Hero />
          <div className="vm-hide-short">
            <QuoteRotator />
          </div>
          <PlaylistChips />

          {/* Flavour, and the first thing to go when height is scarce. */}
          <div className="vm-hide-short hidden lg:block">
            <StatsPanel />
          </div>
        </div>
      </div>

      <div className="vm-hide-short shrink-0">
        <StatusBar />
      </div>
    </div>
  );
}
