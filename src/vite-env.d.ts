/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;

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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
