const PREFIX = 'vibe-mode';

export const STORAGE_KEYS = {
  selectedTheme: `${PREFIX}.selectedTheme`,
  selectedPlaylists: `${PREFIX}.selectedPlaylists`,
  volume: `${PREFIX}.volume`,
  muted: `${PREFIX}.muted`,
  preferences: `${PREFIX}.preferences`,
  playlistOverrides: `${PREFIX}.playlistOverrides`,
  hasEntered: `${PREFIX}.hasEntered`,
} as const;

/**
 * localStorage is unavailable in some privacy modes and throws on quota
 * errors, so every access is guarded. A failed read simply returns the
 * fallback and a failed write is dropped — persistence is a nicety here, not
 * something the app depends on.
 */
export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
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
