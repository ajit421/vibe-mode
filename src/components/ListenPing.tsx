import { useEffect, useRef } from 'react';
import { usePlayer } from '@/state/player-context';
import { useVibe } from '@/state/vibe-context';
import { newSyncKey } from '@/sync/sync';

/** One ping a minute while playing: one billed request each (functions/api/listen.ts). */
const EVERY_MS = 60_000;
const TAB_KEY = 'vibe-mode.tab';

/**
 * A random id for this tab only (sessionStorage), so its pings update one row
 * instead of adding one a minute. Not the device key and not tied to the
 * profile — the count stays anonymous. Same shape as a key, which is all the
 * server checks.
 */
let tab: string | null = null;
function tabId(): string {
  if (tab) return tab;
  try {
    tab = sessionStorage.getItem(TAB_KEY);
    if (!tab) sessionStorage.setItem(TAB_KEY, (tab = newSyncKey()));
  } catch {
    tab = newSyncKey(); // storage blocked: one id for as long as the page lives
  }
  return tab;
}

/**
 * Anonymous "now playing" for the owner's admin page: while music plays, this
 * tab says once a minute which mode, playlist and song — and once more when it
 * stops. No name, no device key, no IP. The Settings panel tells visitors.
 *
 * Off in development (`npm run dev` proxies /api to the live site, and dev
 * tabs would show up as real listeners) and in browsers that send Global
 * Privacy Control. Failures are ignored: a lost ping only undercounts.
 */
export function ListenPing() {
  const { isPlaying, track } = usePlayer();
  const { theme, playlist } = useVibe();
  const latest = useRef({ track, theme, playlist });
  latest.current = { track, theme, playlist };

  useEffect(() => {
    if (!isPlaying || !import.meta.env.PROD) return;
    if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;

    const send = (playing: boolean) => {
      const { track: song, theme: mode, playlist: list } = latest.current;
      void fetch('/api/listen', {
        method: 'POST',
        // So the "stopped" ping still goes out when the tab is closing.
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: tabId(),
          mode: mode.id,
          modeName: mode.name,
          playlist: list?.id ?? null,
          playlistName: list?.name ?? null,
          track: song?.title ?? null,
          playing,
        }),
      }).catch(() => {});
    };

    send(true);
    const timer = window.setInterval(() => send(true), EVERY_MS);
    return () => {
      window.clearInterval(timer);
      send(false);
    };
  }, [isPlaying]);

  return null;
}
