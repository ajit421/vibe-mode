import { useEffect, useState } from 'react';
import { Download, ListMusic, Moon, Palette, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Slider } from '@/components/ui/Slider';
import { PlaylistChips } from '@/components/player/PlaylistChips';
import { useVibe } from '@/state/vibe-context';
import { usePlayer } from '@/state/player-context';
import { useToast } from '@/state/toast-context';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { cn } from '@/utils/cn';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onOpenCustomize: () => void;
}

const SLEEP_CHOICES = [15, 30, 60, 90] as const;

const CHIP =
  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40';

/** Minutes left, rounded up — "1 min" until it actually stops. */
function minutesLeft(endsAt: number, now: number): number {
  return Math.max(1, Math.ceil((endsAt - now) / 60_000));
}

export function SettingsPanel({ open, onClose, onOpenCustomize }: SettingsPanelProps) {
  const { theme, preferences, setPreference, systemReducedMotion, resetEverything } = useVibe();
  const { volume, setVolume, isMuted, toggleMute, sleepEndsAt, setSleepTimer } = usePlayer();
  const { push } = useToast();
  const { canInstall, install } = useInstallPrompt();

  // Re-render once a minute while a timer runs, so the countdown stays true.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open || !sleepEndsAt) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [open, sleepEndsAt]);

  return (
    <Modal open={open} onClose={onClose} title="Settings" description="Small knobs, big difference.">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h3 className="vm-label text-muted">Motion &amp; atmosphere</h3>

          <Switch
            label="Animations"
            description={
              systemReducedMotion
                ? 'Your system asks for reduced motion, so animation stays off.'
                : 'Transitions, scene movement and the wipe between modes.'
            }
            checked={preferences.motion && !systemReducedMotion}
            disabled={systemReducedMotion}
            onChange={(value) => setPreference('motion', value)}
          />

          <Switch
            label="Ambient effects"
            description="Rain, tunnel lights, dust, film grain."
            checked={preferences.ambient}
            onChange={(value) => setPreference('ambient', value)}
          />

          <Switch
            label="Status readouts"
            description="The connection strip and the little stats panel."
            checked={preferences.hud}
            onChange={(value) => setPreference('hud', value)}
          />

          <Switch
            label="Quotes"
            description="Keep the mode's line on screen. Off, it still appears for a moment whenever you click."
            checked={preferences.quotes}
            onChange={(value) => setPreference('quotes', value)}
          />

          <Switch
            label="Clock"
            description="The time and date in the top corner."
            checked={preferences.clock}
            onChange={(value) => setPreference('clock', value)}
          />

          <button
            type="button"
            onClick={onOpenCustomize}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:border-primary/50"
          >
            <Palette className="size-3.5 text-primary" />
            Customize modes — names, colours, pictures, playlists, order…
          </button>
        </section>

        <section className="flex flex-col gap-3 border-t border-line/60 pt-5">
          <h3 className="vm-label text-muted">Sound</h3>
          <div className="flex items-center gap-3">
            <Slider
              label="Volume"
              value={isMuted ? 0 : volume}
              max={100}
              onChange={setVolume}
              valueText={`${isMuted ? 0 : volume} percent`}
              className="flex-1"
            />
            <span className="w-10 text-right font-mono text-xs text-muted tabular-nums">
              {isMuted ? 0 : volume}
            </span>
          </div>
          <Switch label="Muted" checked={isMuted} onChange={toggleMute} />

          <div className="mt-1 flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <Moon className="size-3.5 text-primary" />
              Sleep timer
              {sleepEndsAt && (
                <span className="font-mono text-xs font-normal text-muted">
                  · stops in {minutesLeft(sleepEndsAt, now)} min
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Sleep timer">
              {SLEEP_CHOICES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={cn(CHIP, 'border-line text-muted hover:text-ink')}
                  onClick={() => {
                    setSleepTimer(minutes);
                    push(`Music stops in ${minutes} minutes. Sleep well.`, 'SLEEP');
                  }}
                >
                  {minutes} min
                </button>
              ))}
              <button
                type="button"
                className={cn(CHIP, 'border-line text-muted hover:text-ink')}
                disabled={!sleepEndsAt}
                aria-pressed={!sleepEndsAt}
                onClick={() => {
                  setSleepTimer(null);
                  push('Sleep timer off.', 'SLEEP');
                }}
              >
                Off
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t border-line/60 pt-5">
          <h3 className="vm-label text-muted">Playlist for {theme.name}</h3>
          <PlaylistChips variant="hero" />
          {/* Adding, renaming, relinking and removing playlists all live in
              Customize now. This panel used to have its own add form and a
              separate "play your own playlist" field — three ways to change a
              link, and the oldest one silently outranked the others. */}
          <button
            type="button"
            onClick={onOpenCustomize}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:border-primary/50"
          >
            <ListMusic className="size-3.5 text-primary" />
            Add, rename or remove playlists
          </button>
        </section>

        {/* Only offered when the browser can really do it — a button that does
            nothing in Firefox or Safari would be worse than no button. */}
        {canInstall && (
          <section className="flex flex-col gap-2 border-t border-line/60 pt-5">
            <h3 className="vm-label text-muted">App</h3>
            <button
              type="button"
              onClick={() => void install()}
              className="inline-flex items-center gap-2 self-start rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-canvas transition-[filter] hover:brightness-110"
            >
              <Download className="size-3.5" />
              Install Vibe Mode as an app
            </button>
            <p className="text-xs text-muted">
              Opens in its own window, starts instantly, and keeps your customisations.
            </p>
          </section>
        )}

        <section className="border-t border-line/60 pt-5">
          <button
            type="button"
            onClick={() => {
              resetEverything();
              onClose();
              push('Everything back to defaults.', 'RESET');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-primary/50 hover:text-ink"
          >
            <RotateCcw className="size-3.5" />
            Reset everything
          </button>
          <p className="mt-2 text-xs text-muted">
            Clears the saved mode, playlist choices, volume and every customisation from this
            browser. Download a backup in Customize first if you might want it back.
          </p>
        </section>
      </div>
    </Modal>
  );
}
