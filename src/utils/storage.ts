const PREFIX = 'vibe-mode';

export const STORAGE_KEYS = {
  selectedTheme: `${PREFIX}.selectedTheme`,
  selectedPlaylists: `${PREFIX}.selectedPlaylists`,
  volume: `${PREFIX}.volume`,
  muted: `${PREFIX}.muted`,
  preferences: `${PREFIX}.preferences`,
  playlistOverrides: `${PREFIX}.playlistOverrides`,
  /** Playlists the listener made themselves, grouped by theme id. */
  customPlaylists: `${PREFIX}.customPlaylists`,
  /** The listener's edits to modes, the modes they added, order and visibility. */
  customization: `${PREFIX}.customization`,
  /** Pictures the listener uploaded, by mode id — apart, so text edits never rewrite them. */
  uploads: `${PREFIX}.uploads`,
  hasEntered: `${PREFIX}.hasEntered`,
} as const;

const kindOf = (value: unknown): string => (Array.isArray(value) ? 'array' : typeof value);

/**
 * localStorage is unavailable in some privacy modes and throws on quota
 * errors, so every access is guarded. A failed read simply returns the
 * fallback and a failed write is dropped — persistence is a nicety here, not
 * something the app depends on.
 *
 * Stored values are also shape-checked against the fallback. Without that, a
 * hand-edited entry or one left behind by an older version (a bare `null`, an
 * array where an object is expected) would flow straight into state and crash
 * the app on every load — with no way out, since the bad value is persisted.
 */
export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    if (fallback !== null && fallback !== undefined && kindOf(parsed) !== kindOf(fallback)) {
      return fallback;
    }

    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — ignore */
  }
}

export function clearStoredPreferences(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of Object.values(STORAGE_KEYS)) window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
