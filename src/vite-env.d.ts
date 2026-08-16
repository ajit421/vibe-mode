/// <reference types="vite/client" />

/**
 * Every playlist ID the site can use, one variable per playlist. The names are
 * derived from the playlist ids in `src/music/playlists.ts` — see `envVarFor`.
 * Declared here purely for editor autocomplete; the app reads them
 * dynamically, so a new playlist works without touching this file.
 */
interface ImportMetaEnv {
  readonly VITE_PLAYLIST_JUDAAD_NIGHT?: string;
  readonly VITE_PLAYLIST_JUDAAD_CHAI?: string;
  readonly VITE_PLAYLIST_METRO_VIBES?: string;
  readonly VITE_PLAYLIST_METRO_RUSH?: string;
  readonly VITE_PLAYLIST_TRAIN_WINDOW?: string;
  readonly VITE_PLAYLIST_TRAIN_NIGHT?: string;
  readonly VITE_PLAYLIST_CAB_NIGHT?: string;
  readonly VITE_PLAYLIST_CAB_RAIN?: string;
  readonly VITE_PLAYLIST_OFFICE_FOCUS?: string;
  readonly VITE_PLAYLIST_OFFICE_LUNCH?: string;
  readonly VITE_PLAYLIST_RADIO_RETRO?: string;
  readonly VITE_PLAYLIST_RADIO_LATENIGHT?: string;
  readonly VITE_PLAYLIST_GADI_HITS?: string;
  readonly VITE_PLAYLIST_GADI_HIGHWAY?: string;
  readonly VITE_PLAYLIST_COLLEGE_VIBES?: string;
  readonly VITE_PLAYLIST_COLLEGE_CANTEEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
