import { useEffect, useRef } from 'react';
import { THEMES } from '@/themes';
import { PLAYLISTS } from '@/music/playlists';
import { usePlayer } from '@/state/player-context';
import { useVibe } from '@/state/vibe-context';
import { accountKey, counting, hints, noteFailedReport, noteMode, report, setLinking, setPlaying, setVisible, tabId, track } from '@/utils/analytics';

/** One ping a minute while playing: one billed request each (functions/api/listen.ts). */
const EVERY_MS = 60_000;
const VISITED_KEY = 'vibe-mode.visited';

/** Runs `effect` when `value` changes — not on the first render, which is a starting state, not a use. */
function useChange<T>(value: T, effect: (value: T) => void) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    effect(value);
    // Only `value` decides when this runs; `effect` is a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

/** A listener's own mode or playlist is counted as such: its id is random and its name is theirs. */
const ownOr = (id: string, prefix: string, label: string) => (id.startsWith(prefix) ? label : id);

/** A built-in mode's name from its theme file — not as the visitor renamed it — or a kind. */
const shippedModeName = (id: string) => THEMES.find((theme) => theme.id === id)?.name ?? 'own mode';

/** A built-in playlist's catalogue name, or a kind for the visitor's own. */
function shippedPlaylistName(id: string): string {
  for (const lists of Object.values(PLAYLISTS)) {
    const hit = lists.find((list) => list.id === id);
    if (hit) return hit.name;
  }
  return 'own playlist';
}

/**
 * Anonymous counts for the owner's admin page (see src/utils/analytics.ts for
 * what is sent and when it isn't). This component only wires the app to it:
 *  - once per tab, "a tab opened the site" (/api/visit);
 *  - while music plays, once a minute which mode, playlist and song, and once
 *    more when it stops (/api/listen) — the server turns these into minutes;
 *  - when the tab is hidden or closed, the visit's time open, on screen and
 *    listening, with the features used (/api/session);
 *  - the uses it can see from here: modes and playlists picked, songs
 *    started, shuffle, repeat, mute, player errors. Other components count
 *    their own with `track()` (panels, shortcuts, sign-in, customising…).
 * Failures are ignored: a lost report only undercounts.
 */
export function Analytics() {
  const { isPlaying, track: song, status, shuffle, repeat, isMuted } = usePlayer();
  const { theme, playlist, hasEntered, preferences } = useVibe();
  const latest = useRef({ song, theme, playlist });
  latest.current = { song, theme, playlist };

  // "Link my activity to my account" (Settings): whether reports carry the device key.
  useEffect(() => setLinking(preferences.linkActivity), [preferences.linkActivity]);

  useEffect(() => {
    if (!counting()) return;
    try {
      if (sessionStorage.getItem(VISITED_KEY)) return; // a reload is the same visit
    } catch {
      /* storage blocked: counted once per page load instead */
    }
    void fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hints()),
    })
      .then((response) => {
        // Marked only once the server took it: a failed count (offline, a deploy
        // ahead of its migration) is tried again on the next load, not lost.
        if (response.ok) sessionStorage.setItem(VISITED_KEY, '1');
      })
      .catch(noteFailedReport);
  }, []);

  // The visit report: sent whenever the tab is hidden (switching tabs or apps,
  // locking the phone) and when it closes. Hidden comes first on a close in
  // today's browsers and is the one mobile browsers reliably fire; pagehide
  // covers the rest. Sending twice is harmless (totals only grow).
  useEffect(() => {
    if (!counting()) return;
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setVisible(visible);
      if (!visible) report();
    };
    const onPageHide = () => {
      setVisible(false);
      report();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    setPlaying(isPlaying);
    if (!isPlaying || !counting()) return;

    const send = (playing: boolean) => {
      const { song: current, theme: mode, playlist: list } = latest.current;
      void fetch('/api/listen', {
        method: 'POST',
        // So the "stopped" ping still goes out when the tab is closing.
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: tabId(),
          mode: mode.id,
          // The names the site ships, never the visitor's own wording: a
          // renamed or own mode / playlist is the visitor's text, which the
          // anonymous counts must not carry (/privacy, CLAUDE.md).
          modeName: shippedModeName(mode.id),
          playlist: list?.id ?? null,
          playlistName: list ? shippedPlaylistName(list.id) : null,
          track: current?.title ?? null,
          playing,
          key: accountKey(),
          ...hints(),
        }),
      }).catch(noteFailedReport);
    };

    send(true);
    const timer = window.setInterval(() => send(true), EVERY_MS);
    return () => {
      window.clearInterval(timer);
      send(false);
    };
  }, [isPlaying]);

  // Uses seen from here. The first mode counts too: it is where the visit landed.
  useEffect(() => {
    noteMode(theme.id);
    track('mode', ownOr(theme.id, 'my-', 'own mode'));
  }, [theme.id]);
  useChange(playlist?.id, (id) => id && track('playlist', ownOr(id, 'custom-', 'own playlist')));
  useChange(hasEntered, (entered) => entered && track('enter'));
  useChange(song?.title, (title) => title && track('song_start', ownOr(latest.current.theme.id, 'my-', 'own mode')));
  useChange(status, (now) => now === 'error' && track('player_error', latest.current.playlist?.id ?? ''));
  useChange(shuffle, (on) => track('shuffle', on ? 'on' : 'off'));
  useChange(repeat, (on) => track('repeat', on ? 'on' : 'off'));
  useChange(isMuted, (muted) => track('mute', muted ? 'on' : 'off'));

  return null;
}
