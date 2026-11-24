import { createContext, useContext } from 'react';
import type { VibePlaylist, VibeTheme } from '@/types/theme';
import type { Customization, ModeEdit, Uploads } from '@/themes/customize';

export interface VibePreferences {
  /** Master switch for animation. Also forced off by the OS setting. */
  motion: boolean;
  /** Decorative background layers — rain, tunnel lights, dust, grain. */
  ambient: boolean;
  /** The status bar and the little stats panel. */
  hud: boolean;
  /**
   * Keep the mode's one-liner on screen permanently. With this off it still
   * appears for a moment whenever you click, so the writing is never lost —
   * it just stops being a fixture of the layout.
   */
  quotes: boolean;
  /** The time and date pill in the top bar. */
  clock: boolean;
}

export const DEFAULT_PREFERENCES: VibePreferences = {
  motion: true,
  ambient: true,
  clock: true,
  // Off by default. The clock strip and the stats panel are the two densest
  // blocks on the screen, and with the scene now filling the background they
  // made the first impression read as a dashboard rather than a place. They
  // are one toggle away in Settings for anyone who wants them.
  hud: false,
  // Off by default, for the same reason as `hud`: on a screen whose whole point
  // is the scene, a permanent block of text over it is the thing you notice
  // first. It still surfaces on click.
  quotes: false,
};

/**
 * A playlist the listener made themselves, saved in their browser.
 *
 * Unlike the built-in ones this *does* carry a YouTube id. The rule that ids
 * never appear in code is about configuration the repo ships — this is a value
 * a person typed into the running site, so it belongs to them and lives in
 * their localStorage, next to the existing playlist overrides.
 */
export interface CustomPlaylist {
  id: string;
  name: string;
  /** A playlist id, or a comma-separated set of video ids. */
  source: string;
}

/** Everything a listener set, as one downloadable file. */
export interface VibeBackup {
  app: 'vibe-mode';
  version: 1;
  customization: Customization;
  preferences: Partial<VibePreferences>;
  customPlaylists: Record<string, CustomPlaylist[]>;
  playlistOverrides: Record<string, string>;
  /** Uploaded pictures by mode id. Optional: backups made before it existed lack it. */
  uploads?: Uploads;
}

/** One mode, shared as a file — imported as a *new* mode, never over an existing one. */
export interface SharedMode {
  app: 'vibe-mode';
  version: 1;
  kind: 'mode';
  /** The built-in mode it is built on (icon, fonts and default music). */
  baseId: string;
  edit: ModeEdit;
  playlists: CustomPlaylist[];
  upload?: string;
}

/** What a restored file turned out to be, or null when it wasn't a Vibe Mode file. */
export type ImportResult =
  | { kind: 'backup' }
  /** `pictureDropped`: the file had a picture, but there was no room left to save it. */
  | { kind: 'mode'; id: string; pictureDropped: boolean }
  | null;

export interface VibeContextValue {
  /** The modes a visitor can pick, in their order — hidden ones left out. */
  themes: readonly VibeTheme[];
  /** Every mode, hidden ones included — for the Customize panel. */
  allThemes: readonly VibeTheme[];
  /** Built-in modes the listener deleted — restorable from the Customize panel. */
  deletedThemes: readonly VibeTheme[];
  theme: VibeTheme;
  themeId: string;

  /** The mode's built-in playlists followed by the listener's own. */
  playlists: VibePlaylist[];
  playlist: VibePlaylist | undefined;
  playlistId: string | null;
  selectPlaylist: (playlistId: string) => void;

  /**
   * Adds one of the listener's own playlists to a mode (the active one unless
   * `modeId` says otherwise). Returns its id, or null when the source was unusable.
   */
  addCustomPlaylist: (name: string, source: string, modeId?: string) => string | null;
  /** Deletes the listener's own playlist, or takes a built-in one off that mode. */
  removePlaylist: (modeId: string, playlistId: string) => void;
  /**
   * Renames or relinks any playlist in a mode. For a built-in one an empty
   * `source` goes back to its default. False when the link can't be read.
   */
  updatePlaylist: (
    modeId: string,
    playlistId: string,
    patch: { name?: string; source?: string },
  ) => boolean;
  isCustomPlaylist: (playlistId: string) => boolean;

  selectTheme: (themeId: string) => void;
  /** The theme being transitioned *to*, while the wipe is on screen. */
  incomingTheme: VibeTheme | null;
  isTransitioning: boolean;

  /** False while the landing "where are you?" screen is showing. */
  hasEntered: boolean;
  enter: (themeId: string) => void;
  leaveToLanding: () => void;

  selectorOpen: boolean;
  setSelectorOpen: (open: boolean) => void;

  preferences: VibePreferences;
  setPreference: <K extends keyof VibePreferences>(key: K, value: VibePreferences[K]) => void;
  /** Motion is genuinely enabled: user preference AND no OS reduce-motion. */
  motionEnabled: boolean;
  systemReducedMotion: boolean;

  /** Links from the old Settings field; still honoured, cleared by a Customize relink. */
  playlistOverrides: Record<string, string>;

  /* ── Listener customisation of the modes themselves ─────────────────── */
  customization: Customization;
  /** Merges into the mode's edits; `colors` merge key by key. */
  editMode: (themeId: string, patch: ModeEdit) => void;
  /** Drops every edit to the mode — back to how it ships. */
  resetMode: (themeId: string) => void;
  /**
   * Copies a mode (edits included) and returns the copy's id. With `blank`,
   * makes an empty new mode instead — no picture, playlists, quotes or layers.
   */
  addMode: (sourceId: string, blank?: boolean) => string | null;
  /**
   * Deletes any mode. One the listener added is gone for good; a built-in one
   * goes to the bin (`deletedThemes`) and `editMode(id, { deleted: false })`
   * brings it back. The last visible mode can't be deleted.
   */
  removeMode: (themeId: string) => void;
  moveMode: (themeId: string, delta: -1 | 1) => void;
  exportSettings: () => VibeBackup;
  /** One mode as a shareable file; null for an unknown id. */
  exportMode: (themeId: string) => SharedMode | null;
  /**
   * Restores a full backup (replacing everything) or adds a shared mode.
   * Null when the file isn't a Vibe Mode file; bad fields are dropped, not fatal.
   */
  importSettings: (raw: unknown) => ImportResult;
  /** Saves an uploaded still for a mode. False when there's no room left to store it. */
  setUpload: (themeId: string, still: string) => boolean;

  resetEverything: () => void;
}

export const VibeContext = createContext<VibeContextValue | null>(null);

export function useVibe(): VibeContextValue {
  const value = useContext(VibeContext);
  if (!value) throw new Error('useVibe must be used inside <VibeProvider>.');
  return value;
}
