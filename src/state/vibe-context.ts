import { createContext, useContext } from 'react';
import type { VibePlaylist, VibeTheme } from '@/types/theme';

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
}

export const DEFAULT_PREFERENCES: VibePreferences = {
  motion: true,
  ambient: true,
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

export interface VibeContextValue {
  themes: readonly VibeTheme[];
  theme: VibeTheme;
  themeId: string;

  /** The mode's built-in playlists followed by the listener's own. */
  playlists: VibePlaylist[];
  playlist: VibePlaylist | undefined;
  playlistId: string | null;
  selectPlaylist: (playlistId: string) => void;

  /** The listener's own playlists for the active mode. */
  customPlaylists: CustomPlaylist[];
  /** Returns the new playlist's id, or null when the source was unusable. */
  addCustomPlaylist: (name: string, source: string) => string | null;
  removeCustomPlaylist: (playlistId: string) => void;
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

  playlistOverrides: Record<string, string>;
  setPlaylistOverride: (playlistId: string, value: string) => void;

  resetEverything: () => void;
}

export const VibeContext = createContext<VibeContextValue | null>(null);

export function useVibe(): VibeContextValue {
  const value = useContext(VibeContext);
  if (!value) throw new Error('useVibe must be used inside <VibeProvider>.');
  return value;
}
