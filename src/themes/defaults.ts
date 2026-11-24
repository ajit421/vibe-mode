import type { VibeTheme } from '@/types/theme';
import { isRecord } from '@/themes/customize';
import { safeImageUrl } from '@/themes/backgrounds';
import { normaliseSource, sourceFields } from '@/music/resolve';
import { STORAGE_KEYS, readStorage, writeStorage } from '@/utils/storage';

/* ══════════════════════════════════════════════════════════════════════════
 *  SITE DEFAULTS
 *
 *  What a visitor sees before changing anything: which playlist each built-in
 *  playlist plays, and each mode's background and poster. They live in the
 *  `defaults` table in D1 (migrations/0001_defaults.sql), served by
 *  functions/api/config.ts. They used to be `VITE_*` variables in `.env`,
 *  baked in at build time; now an edit in the dashboard shows on the next load.
 *
 *  First paint never waits on the network: the last answer is kept in
 *  localStorage and used straight away, and the fresh one replaces it when it
 *  lands. A first-ever visit paints the colour gradients for that moment —
 *  `index.html` preloads `/api/config` so the moment is short.
 * ══════════════════════════════════════════════════════════════════════════ */

export interface SiteDefaults {
  /** Playlist id → normalised source: a playlist id, or comma-separated video ids. */
  playlists: Record<string, string>;
  /** Mode id → background URL (a picture or a looping clip). */
  images: Record<string, string>;
  /** Mode id → still for a video-backed mode's card. */
  posters: Record<string, string>;
}

export const EMPTY_DEFAULTS: SiteDefaults = { playlists: {}, images: {}, posters: {} };

const SAFE_ID = /^[a-z0-9-]{1,60}$/;

function checked(raw: unknown, check: (value: string) => string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!isRecord(raw)) return result;
  for (const [id, value] of Object.entries(raw)) {
    const safe = SAFE_ID.test(id) && typeof value === 'string' ? check(value.trim()) : null;
    if (safe) result[id] = safe;
  }
  return result;
}

/**
 * Same parsers as a link a listener types: a source is a playlist id or video
 * ids and nothing else, and a picture only an http(s) URL or a site path. A
 * bad row is dropped, never passed on to an `src` or the player.
 */
export function sanitizeDefaults(raw: unknown): SiteDefaults {
  if (!isRecord(raw)) return EMPTY_DEFAULTS;
  return {
    playlists: checked(raw.playlists, normaliseSource),
    images: checked(raw.images, safeImageUrl),
    posters: checked(raw.posters, safeImageUrl),
  };
}

/** The defaults this browser saw last — what the first paint uses. */
export const cachedDefaults = (): SiteDefaults =>
  sanitizeDefaults(readStorage<unknown>(STORAGE_KEYS.defaults, null));

/**
 * The current defaults from the site, remembered for next time. `null` when
 * it can't say — offline, the database is down, or a dev server with no
 * `/api` — so the caller keeps what it has rather than blanking the page.
 */
export async function fetchDefaults(): Promise<SiteDefaults | null> {
  try {
    const response = await fetch('/api/config', { headers: { accept: 'application/json' } });
    // An unknown path answers 200 with index.html (the SPA fallback), so the
    // status alone does not prove this is the config.
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      return null;
    }
    const defaults = sanitizeDefaults(await response.json());
    writeStorage(STORAGE_KEYS.defaults, defaults);
    return defaults;
  } catch {
    return null;
  }
}

/**
 * The theme files with the defaults filled in. Runs before the listener's
 * customisation is laid on top, so their own links and pictures still win,
 * and an added mode — copied from one of these — borrows its base's defaults.
 */
export function withDefaults(themes: readonly VibeTheme[], defaults: SiteDefaults): VibeTheme[] {
  return themes.map((theme) => ({
    ...theme,
    defaultImage: defaults.images[theme.id],
    defaultPoster: defaults.posters[theme.id],
    playlists: theme.playlists.map((playlist) => {
      const source = defaults.playlists[playlist.id];
      return source ? { ...playlist, ...sourceFields(source) } : playlist;
    }),
  }));
}
