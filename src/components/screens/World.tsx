import { Hero } from '@/components/hero/Hero';
import { QuoteRotator } from '@/components/hero/QuoteRotator';
import { StatsPanel } from '@/components/hero/StatsPanel';
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
    <div className="pointer-events-none mx-auto flex h-full max-w-[1600px] flex-col gap-3 px-4 pt-14 pb-4 sm:px-6 sm:pt-16 lg:gap-4 lg:px-8 lg:pt-20 lg:pb-7">
      <div className="flex min-h-0 flex-1 flex-col justify-end">
        {/* The text carries its own surface rather than asking the scene to dim
            itself into a backdrop. A small, deliberate panel costs the artwork
            one corner; a gradient wide enough to make loose text readable costs
            it half the frame. `w-fit` keeps the panel as tight as its content,
            and `pointer-events-auto` is safe here because the panel is opaque
            anyway — nothing behind it is clickable. */}
        <div className="pointer-events-auto vm-panel flex w-fit min-w-0 max-w-full flex-col rounded-2xl px-5 py-4 sm:px-6 sm:py-5 lg:max-w-[38rem]">
          {/* No playlist switcher here. It lives in the player's expanded
              drawer and in Settings, which is where you go when you actually
              want to change what is playing — on this screen it was a second
              set of controls competing with the player bar directly below it. */}
          <Hero />

          <div className="vm-hide-short mt-5 lg:mt-6">
            <QuoteRotator />
          </div>

          {/* Flavour, and the first thing to go when height is scarce. */}
          <div className="vm-hide-short mt-6 hidden lg:block">
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
