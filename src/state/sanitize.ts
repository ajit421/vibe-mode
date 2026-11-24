import { isRecord } from '@/themes/customize';
import { extractPlaylistId, normaliseSource } from '@/music/resolve';
import { DEFAULT_PREFERENCES, type CustomPlaylist, type VibePreferences } from './vibe-context';

/*
 * Checks for the listener's stored data that isn't part of the customisation
 * record. They run on every load and every sync from another tab — not just on
 * an imported file — because `readStorage` only checks the top-level shape: a
 * stored `{"metro": "x"}` passed that, reached `.map()` on a string, and
 * crashed the app on every load with no way out but the crash screen.
 * Every field is rebuilt, never copied.
 */

const SAFE_KEY = /^[a-z0-9-]{1,60}$/;
const CUSTOM_ID = /^custom-[a-z0-9]{1,16}$/;

/** Only known preferences, only booleans; the rest fall back to the defaults. */
export function sanitizePreferences(raw: unknown): VibePreferences {
  if (!isRecord(raw)) return DEFAULT_PREFERENCES;
  const keys = Object.keys(DEFAULT_PREFERENCES) as (keyof VibePreferences)[];
  return {
    ...DEFAULT_PREFERENCES,
    ...Object.fromEntries(keys.filter((key) => typeof raw[key] === 'boolean').map((key) => [key, raw[key]])),
  };
}

/** Mode id → the listener's own playlists, each with a link the player can actually load. */
export function sanitizeCustomPlaylists(raw: unknown): Record<string, CustomPlaylist[]> {
  if (!isRecord(raw)) return {};
  const result: Record<string, CustomPlaylist[]> = {};
  for (const [themeId, list] of Object.entries(raw)) {
    if (!SAFE_KEY.test(themeId) || !Array.isArray(list)) continue;
    result[themeId] = list.flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== 'string' || !CUSTOM_ID.test(item.id)) return [];
      const source = typeof item.source === 'string' ? normaliseSource(item.source) : null;
      if (!source) return [];
      const name =
        typeof item.name === 'string' && item.name.trim() ? item.name.slice(0, 60) : 'My playlist';
      return [{ id: item.id, name, source }];
    });
  }
  return result;
}

/** Playlist id → a link from the old Settings field, reduced to a clean playlist id. */
export function sanitizeOverrides(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const result: Record<string, string> = {};
  for (const [playlistId, value] of Object.entries(raw)) {
    const id = typeof value === 'string' ? extractPlaylistId(value) : null;
    if (SAFE_KEY.test(playlistId) && id) result[playlistId] = id;
  }
  return result;
}
