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
    // Each readout is its own small frosted chip. The strip used to be bare
    // text over a hairline, which sat straight on the photo and was only as
    // legible as whatever happened to be behind it.
    <div className="pointer-events-auto">
      <div className="flex flex-wrap items-center gap-2">
        <div className="vm-panel flex items-center gap-1.5 rounded-md px-2.5 py-1">
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
          <div key={`${index}-${item.label}`} className="vm-panel flex items-center gap-1.5 rounded-md px-2.5 py-1">
            {/* The label in the mode's colour, the value in plain ink. */}
            <span className="vm-label text-primary">{item.label}</span>
            <span className="font-mono text-xs text-ink/90">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Ticker />
      </div>
    </div>
  );
}
