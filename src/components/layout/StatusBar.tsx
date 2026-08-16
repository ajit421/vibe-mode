import { Wifi, WifiOff } from 'lucide-react';
import { useVibe } from '@/state/vibe-context';
import { useClock } from '@/hooks/useClock';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Ticker } from '@/components/hero/Ticker';

const TIME = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const DATE = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

/**
 * The ambient readout strip: clock, date, whatever small facts the current
 * mode wants to brag about, and the rotating terminal line.
 */
export function StatusBar() {
  const { theme, preferences } = useVibe();
  const now = useClock(1000);
  const online = useNetworkStatus();

  if (!preferences.hud) return null;

  return (
    <div className="border-t border-line/60 pt-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-lg font-medium text-ink tabular-nums">
            {TIME.format(now)}
          </span>
          <span className="vm-label text-muted">{DATE.format(now)}</span>
        </div>

        <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          {online ? (
            <Wifi className="size-3.5 text-accent" aria-hidden="true" />
          ) : (
            <WifiOff className="size-3.5 text-primary" aria-hidden="true" />
          )}
          <span className="vm-label text-muted">
            {online ? 'Connection stable' : 'Offline — music will not load'}
          </span>
        </div>

        {(theme.hud ?? []).map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
            <span className="vm-label text-muted/70">{item.label}</span>
            <span className="font-mono text-xs text-ink/85">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Ticker />
      </div>
    </div>
  );
}
