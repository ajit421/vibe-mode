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

  /**
   * One background picture per mode. Names are derived from the theme id —
   * see `imageVarFor` in `src/themes/backgrounds.ts`. Declared here purely for
   * editor autocomplete; the app reads them dynamically, so a new mode works
   * without touching this file.
   */
  readonly VITE_IMAGE_JUDAAD_HOUSE?: string;
  readonly VITE_IMAGE_METRO?: string;
  readonly VITE_IMAGE_INDIAN_TRAIN?: string;
  readonly VITE_IMAGE_CAB_WALA?: string;
  readonly VITE_IMAGE_OFFICE?: string;
  readonly VITE_IMAGE_RADIO_WALA?: string;
  readonly VITE_IMAGE_GADI_WALA?: string;
  readonly VITE_IMAGE_COLLEGE?: string;

  /**
   * Poster still for a mode whose background is a video — see `posterVarFor`.
   * Used for the mode's card on the landing screen, which never loads the
   * clip itself. Same story as above: declared for autocomplete only.
   */
  readonly VITE_POSTER_JUDAAD_HOUSE?: string;
  readonly VITE_POSTER_METRO?: string;
  readonly VITE_POSTER_INDIAN_TRAIN?: string;
  readonly VITE_POSTER_CAB_WALA?: string;
  readonly VITE_POSTER_OFFICE?: string;
  readonly VITE_POSTER_RADIO_WALA?: string;
  readonly VITE_POSTER_GADI_WALA?: string;
  readonly VITE_POSTER_COLLEGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
