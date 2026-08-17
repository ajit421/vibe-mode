import { useEffect, useState } from 'react';
import { Check, Plus, RotateCcw, Trash2, TriangleAlert, Undo2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Slider } from '@/components/ui/Slider';
import { PlaylistChips } from '@/components/player/PlaylistChips';
import { useVibe } from '@/state/vibe-context';
import { usePlayer } from '@/state/player-context';
import { useToast } from '@/state/toast-context';
import { extractPlaylistId } from '@/music/resolve';
import { envVarFor } from '@/music/playlists';

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
    customPlaylists,
    addCustomPlaylist,
    removeCustomPlaylist,
    isCustomPlaylist,
    resetEverything,
  } = useVibe();
  const { volume, setVolume, isMuted, toggleMute } = usePlayer();
  const { push } = useToast();

  const [newName, setNewName] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newInvalid, setNewInvalid] = useState(false);

  const createPlaylist = () => {
    const id = addCustomPlaylist(newName, newSource);
    if (!id) {
      setNewInvalid(true);
      return;
    }
    setNewInvalid(false);
    setNewName('');
    setNewSource('');
    push(`“${newName.trim() || 'My playlist'}” added to ${theme.name}.`, 'PLAYLIST');
  };

  const currentOverride = playlist ? (playlistOverrides[playlist.id] ?? '') : '';
  // `playlist` already has the .env value merged in by `playlistsFor`.
  const envDefault = Boolean(playlist?.youtubePlaylistId || playlist?.videoIds?.length);
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

          <Switch
            label="Quotes"
            description="Keep the mode's line on screen. Off, it still appears for a moment whenever you click."
            checked={preferences.quotes}
            onChange={(value) => setPreference('quotes', value)}
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

          {/* ── Make your own ─────────────────────────────────────────────── */}
          <div className="mt-2 rounded-xl border border-line/60 bg-canvas/40 p-3.5">
            <p className="text-sm font-medium text-ink">Your own playlists</p>
            <p className="mt-0.5 text-xs text-muted">
              Give it a name, paste a YouTube playlist link — or a few video links separated by
              commas — and it joins the list above for {theme.name}. Saved in this browser only.
            </p>

            {customPlaylists.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {customPlaylists.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg border border-line/60 bg-surface/50 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs text-ink">{item.name}</span>
                    <code className="hidden max-w-[9rem] truncate font-mono text-[0.65rem] text-muted sm:block">
                      {item.source}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        removeCustomPlaylist(item.id);
                        push(`“${item.name}” removed.`, 'PLAYLIST');
                      }}
                      aria-label={`Delete ${item.name}`}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-ink/8 hover:text-primary"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') createPlaylist();
                }}
                placeholder="Name — e.g. Late night drive"
                aria-label="New playlist name"
                className="min-w-0 rounded-lg border border-line bg-canvas/60 px-3 py-2 text-xs text-ink placeholder:text-muted/60 focus-visible:border-primary/60 sm:w-44"
              />
              <input
                type="text"
                inputMode="url"
                spellCheck={false}
                autoComplete="off"
                value={newSource}
                onChange={(event) => {
                  setNewSource(event.target.value);
                  setNewInvalid(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') createPlaylist();
                }}
                placeholder="Playlist link, or video links"
                aria-label="New playlist source"
                aria-invalid={newInvalid}
                className="min-w-0 flex-1 rounded-lg border border-line bg-canvas/60 px-3 py-2 font-mono text-xs text-ink placeholder:text-muted/60 focus-visible:border-primary/60"
              />
              <button
                type="button"
                onClick={createPlaylist}
                disabled={!newSource.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-canvas transition-[filter] hover:brightness-110 disabled:opacity-40"
              >
                <Plus className="size-3.5" />
                Add
              </button>
            </div>

            {newInvalid && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                <TriangleAlert className="size-3.5 shrink-0" />
                Couldn’t read a playlist or video out of that. Paste the full YouTube link.
              </p>
            )}
          </div>

          <div className="mt-2">
            <label htmlFor="playlist-override" className="text-sm font-medium text-ink">
              Play your own playlist
            </label>
            <p className="mt-0.5 text-xs text-muted">
              Paste any YouTube playlist link or ID to play it here instead of “
              {playlist?.name ?? 'this playlist'}”. Saved in this browser only — nobody else sees
              it, and clearing the field goes back to the default.
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
                className="min-w-0 flex-1 rounded-lg border border-line bg-canvas/60 px-3 py-2 font-mono text-xs text-ink placeholder:text-muted/60 focus-visible:border-primary/60"
              />
              <button
                type="button"
                onClick={applyOverride}
                disabled={!playlist}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-canvas transition-[filter] hover:brightness-110 disabled:opacity-40"
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

            {currentOverride && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="vm-label rounded-full bg-accent/12 px-2 py-1 text-accent">
                  Your playlist is active
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!playlist) return;
                    setPlaylistOverride(playlist.id, '');
                    setDraft('');
                    push('Back to the default playlist.', 'SETTINGS');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-primary/50 hover:text-ink"
                >
                  <Undo2 className="size-3.5" />
                  Use the default
                </button>
              </div>
            )}

            {/* Where the default comes from, named exactly so it can be set.
                A playlist the listener made has no env variable behind it, so
                naming one would send them looking for a line that shouldn't
                exist. */}
            {playlist && !isCustomPlaylist(playlist.id) && (
              <p className="mt-3 text-xs text-muted">
                The default for this playlist is read from{' '}
                <code className="rounded bg-ink/8 px-1 py-0.5 font-mono text-[0.7rem] text-ink/80">
                  {envVarFor(playlist.id)}
                </code>{' '}
                in <code className="font-mono text-[0.7rem]">.env</code>
                {envDefault ? '.' : ' — not set yet.'}
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
