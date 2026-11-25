import { useEffect, useRef } from 'react';
import { usePlayer } from '@/state/player-context';
import { useVibe } from '@/state/vibe-context';
import { useSync } from '@/state/sync-context';
import { pollRemote, type RemoteCommand } from '@/sync/api';
import { readRecord } from '@/sync/sync';

/** How often a listening tab checks for commands. Each check is one request against the free 100k/day. */
const POLL_MS = 4_000;

/**
 * Lets an AI assistant drive the player in this tab, through the MCP server
 * (server/mcp.ts → `control_player`). Only while the listener switched it on
 * in Customize — until then it does nothing and costs nothing.
 *
 * Each poll reports what's playing (only when that changed), runs the queued
 * commands in order, and reloads the cloud copy when an assistant changed
 * the modes. Commands run as if the listener pressed the buttons; "play"
 * works once they've interacted with the page, as browsers require.
 */
export function RemoteControl() {
  const { remoteControl, refresh } = useSync();
  const player = usePlayer();
  const { theme, playlist, playlists, allThemes, selectTheme, selectPlaylist } = useVibe();

  const latest = useRef({ player, theme, playlist, playlists, allThemes, selectTheme, selectPlaylist, refresh });
  latest.current = { player, theme, playlist, playlists, allThemes, selectTheme, selectPlaylist, refresh };

  useEffect(() => {
    if (!remoteControl) return;
    let stopped = false;
    let timer: number | undefined;
    let reported = '';

    const run = ({ action, value }: RemoteCommand) => {
      const { player: p, playlists: list, allThemes: modes } = latest.current;
      if (action === 'play') p.play();
      else if (action === 'pause') p.pause();
      else if (action === 'next') p.next();
      else if (action === 'previous') p.previous();
      else if (action === 'mute' && !p.isMuted) p.toggleMute();
      else if (action === 'unmute' && p.isMuted) p.toggleMute();
      else if (action === 'set_volume') p.setVolume(Number(value));
      else if (action === 'switch_mode' && modes.some((mode) => mode.id === value)) latest.current.selectTheme(value!);
      else if (action === 'select_playlist' && list.some((item) => item.id === value)) latest.current.selectPlaylist(value!);
    };

    const tick = async () => {
      const key = readRecord().key;
      if (key) {
        const { player: p, theme: t, playlist: pl } = latest.current;
        const state = {
          mode: t.id,
          modeName: t.name,
          playlist: pl?.id ?? null,
          playlistName: pl?.name ?? null,
          playlists: latest.current.playlists.map((item) => ({ id: item.id, name: item.name })),
          playing: p.isPlaying,
          track: p.track?.title ?? null,
          artist: p.track?.author ?? null,
          volume: p.volume,
          muted: p.isMuted,
        };
        const snapshot = JSON.stringify(state);
        const result = await pollRemote(key, snapshot === reported ? undefined : state);
        if (result.ok) {
          reported = snapshot;
          for (const command of result.body.commands) {
            run(command);
            // A mode switch lands only after its transition (with motion on), and
            // a playlist picked straight after it is checked against — and saved
            // to — whichever mode is showing. Wait for the new one first.
            const target = command.value;
            if (command.action === 'switch_mode' && target && latest.current.allThemes.some((mode) => mode.id === target)) {
              for (let waited = 0; waited < 2_000 && latest.current.theme.id !== target; waited += 50) {
                await new Promise((resolve) => window.setTimeout(resolve, 50));
              }
            }
          }
          const version = result.body.version;
          if (version !== null && version !== readRecord().version) latest.current.refresh();
        }
      }
      if (!stopped) timer = window.setTimeout(() => void tick(), POLL_MS);
    };

    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [remoteControl]);

  return null;
}
