import { Hero } from '@/components/hero/Hero';
import { QuoteRotator } from '@/components/hero/QuoteRotator';
import { CentralVisual } from '@/components/hero/CentralVisual';
import { StatsPanel } from '@/components/hero/StatsPanel';
import { PlaylistChips } from '@/components/player/PlaylistChips';
import { StatusBar } from '@/components/layout/StatusBar';

/** The active mode, once you're inside it. */
export function World() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-20 sm:px-6 sm:pt-24">
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-x-14 lg:gap-y-9">
        <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
          <Hero />
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <CentralVisual />
        </div>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2 lg:self-start">
          <QuoteRotator />
          <PlaylistChips />
          <StatsPanel />
        </div>
      </div>

      <div className="mt-10">
        <StatusBar />
      </div>
    </div>
  );
}
