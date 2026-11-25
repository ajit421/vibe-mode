import { useEffect, useRef } from 'react';
import { usePlayer } from '@/state/player-context';
import { useVibe } from '@/state/vibe-context';
import { newSyncKey } from '@/sync/sync';

/** One ping a minute while playing: one billed request each (functions/api/listen.ts). */
const EVERY_MS = 60_000;
const TAB_KEY = 'vibe-mode.tab';
const VISITED_KEY = 'vibe-mode.visited';

/**
 * Counting is off in development (`npm run dev` proxies /api to the live
 * site, so dev tabs would be counted there) and in browsers that send Global
 * Privacy Control.
 */
const counting = (): boolean =>
  import.meta.env.PROD && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;

/**
 * What only the page knows (server/ua.ts reads the rest from the request):
 * Brave calls itself Chrome, and an iPad asking for desktop sites calls itself a Mac.
 */
const hints = () => ({ brave: 'brave' in navigator, touch: navigator.maxTouchPoints > 1 });

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
 * Anonymous counts for the owner's admin page. The Settings panel tells visitors.
 *  - Once per tab: "a tab opened the site" (/api/visit), counted by day,
 *    browser, system, device and country.
 *  - While music plays: once a minute which mode, playlist and song, and once
 *    more when it stops (/api/listen).
 * No name, no device key, no IP; the server keeps only coarse buckets.
 * Failures are ignored: a lost ping only undercounts.
 */
export function ListenPing() {
  const { isPlaying, track } = usePlayer();
  const { theme, playlist } = useVibe();
  const latest = useRef({ track, theme, playlist });
  latest.current = { track, theme, playlist };

  useEffect(() => {
    if (!counting()) return;
    try {
      if (sessionStorage.getItem(VISITED_KEY)) return; // a reload is the same visit
      sessionStorage.setItem(VISITED_KEY, '1');
    } catch {
      /* storage blocked: counted once per page load instead */
    }
    void fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hints()),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isPlaying || !counting()) return;

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
          ...hints(),
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
