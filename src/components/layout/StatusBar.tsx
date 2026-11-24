import { Wifi, WifiOff } from 'lucide-react';
import { useVibe } from '@/state/vibe-context';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Ticker } from '@/components/hero/Ticker';

/**
 * The ambient readout strip: connection, whatever small facts the current
 * mode wants to brag about, and the rotating terminal line.
 *
 * No clock here any more. The top bar already shows the time and date (with
 * its own on/off switch), so turning readouts on used to put the time on
 * screen twice.
 */
export function StatusBar() {
  const { theme, preferences } = useVibe();
  const online = useNetworkStatus();

  if (!preferences.hud) return null;

  return (
    <div className="border-t border-line/60 pt-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
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

        {(theme.hud ?? []).map((item, index) => (
          // Position as well as label: visitors type these now, and two items
          // with the same label must still be two items.
          <div key={`${index}-${item.label}`} className="flex items-center gap-1.5">
            <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
            {/* Full `muted`, not `muted/70` — at 11px the faded variant lands
                around 4.2:1 on the darker themes, under the AA threshold. */}
            <span className="vm-label text-muted">{item.label}</span>
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
