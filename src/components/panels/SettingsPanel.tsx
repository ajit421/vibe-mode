import { useEffect, useState } from 'react';
import { Check, RotateCcw, TriangleAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Slider } from '@/components/ui/Slider';
import { PlaylistChips } from '@/components/player/PlaylistChips';
import { useVibe } from '@/state/vibe-context';
import { usePlayer } from '@/state/player-context';
import { useToast } from '@/state/toast-context';
import { extractPlaylistId } from '@/music/resolve';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const {
    theme,
    playlist,
    preferences,
    setPreference,
    systemReducedMotion,
    playlistOverrides,
    setPlaylistOverride,
    resetEverything,
  } = useVibe();
  const { volume, setVolume, isMuted, toggleMute } = usePlayer();
  const { push } = useToast();

  const currentOverride = playlist ? (playlistOverrides[playlist.id] ?? '') : '';
  const [draft, setDraft] = useState(currentOverride);
  const [invalid, setInvalid] = useState(false);

  // Reset the field whenever the panel opens or the playlist changes under it.
  useEffect(() => {
    setDraft(currentOverride);
    setInvalid(false);
  }, [currentOverride, open]);

  const applyOverride = () => {
    if (!playlist) return;
    const trimmed = draft.trim();

    if (!trimmed) {
      setPlaylistOverride(playlist.id, '');
      setInvalid(false);
      push('Override cleared. Back to the configured playlist.', 'SETTINGS');
      return;
    }

    const id = extractPlaylistId(trimmed);
    if (!id) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    setPlaylistOverride(playlist.id, id);
    push(`“${playlist.name}” now points at ${id}`, 'SETTINGS');
  };

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
            description="The clock strip and the little stats panel."
            checked={preferences.hud}
            onChange={(value) => setPreference('hud', value)}
          />
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
        </section>

        <section className="flex flex-col gap-3 border-t border-line/60 pt-5">
          <h3 className="vm-label text-muted">Playlist for {theme.name}</h3>
          <PlaylistChips variant="hero" />

          <div className="mt-2">
            <label
              htmlFor="playlist-override"
              className="text-sm font-medium text-ink"
            >
              YouTube playlist ID
            </label>
            <p className="mt-0.5 text-xs text-muted">
              Paste a playlist link or ID to point “{playlist?.name ?? 'this playlist'}” somewhere
              else. Stored in this browser only — for a permanent change, edit{' '}
              <code className="rounded bg-ink/8 px-1 py-0.5 font-mono text-[0.7rem]">
                src/music/playlists.ts
              </code>
              .
            </p>

            <div className="mt-2.5 flex gap-2">
              <input
                id="playlist-override"
                type="text"
                inputMode="url"
                spellCheck={false}
                autoComplete="off"
                value={draft}
                disabled={!playlist}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setInvalid(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyOverride();
                }}
                placeholder="PLxxxxxxxxxxxx or a playlist URL"
                aria-invalid={invalid}
                className="min-w-0 flex-1 rounded-lg border border-line bg-base/60 px-3 py-2 font-mono text-xs text-ink placeholder:text-muted/60 focus-visible:border-primary/60"
              />
              <button
                type="button"
                onClick={applyOverride}
                disabled={!playlist}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-base transition-[filter] hover:brightness-110 disabled:opacity-40"
              >
                <Check className="size-3.5" />
                Apply
              </button>
            </div>

            {invalid && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                <TriangleAlert className="size-3.5 shrink-0" />
                That doesn’t look like a playlist ID. Look for the <code>list=</code> part of the URL.
              </p>
            )}
          </div>
        </section>

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
            Clears the saved mode, playlist choices, volume and overrides from this browser.
          </p>
        </section>
      </div>
    </Modal>
  );
}
