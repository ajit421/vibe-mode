import { QuoteRotator } from '@/components/hero/QuoteRotator';
import { StatsPanel } from '@/components/hero/StatsPanel';
import { StatusBar } from '@/components/layout/StatusBar';

/**
 * The active mode, once you're inside it.
 *
 * Almost nothing is left here on purpose. The scene fills the window behind
 * everything (see `SceneBackground`), and the mode's name and status line have
 * moved up to the top bar. What remains is the one line of inner monologue,
 * and the stats block when the status readouts are switched on.
 *
 * The whole panel carries `vm-hide-short`, not just its contents: on a short
 * window the line inside it is hidden, and a panel wrapped around nothing is
 * an empty box floating over the artwork.
 *
 * Wrappers are `pointer-events-none` so a click on empty space falls through
 * to the scene's hotspots behind; the panel and the controls inside it turn
 * pointer events back on.
 *
 * This screen never scrolls — it is sized to whatever height the shell gives
 * it.
 */
export function World() {
  return (
    <div className="pointer-events-none mx-auto flex h-full max-w-[1600px] flex-col gap-3 px-4 pt-14 pb-4 sm:px-6 sm:pt-16 lg:gap-4 lg:px-8 lg:pt-20 lg:pb-7">
      <div className="flex min-h-0 flex-1 flex-col justify-end">
        {/* `gap`, not margins on a wrapper: `StatsPanel` renders nothing when
            the status readouts are off, and a wrapper div around it would still
            contribute its own spacing to this column. With no wrapper there is
            no flex item, so there is no gap either. */}
        <div className="vm-panel vm-hide-short pointer-events-auto flex w-fit min-w-0 max-w-full flex-col gap-5 rounded-2xl px-5 py-4 sm:px-6 sm:py-5 lg:max-w-[38rem]">
          <QuoteRotator />
          <StatsPanel />
        </div>
      </div>

      <div className="vm-hide-short shrink-0">
        <StatusBar />
      </div>
    </div>
  );
}
