import type { LucideIcon } from 'lucide-react';

/**
 * A playlist attached to a vibe.
 *
 * Supply EITHER a `youtubePlaylistId` (preferred — the `list=` value from a
 * YouTube playlist URL) OR an explicit `videoIds` array. If both are present
 * the playlist ID wins. If neither is set the player shows a friendly
 * "not configured yet" state instead of breaking.
 */
export interface VibePlaylist {
  id: string;
  name: string;
  description: string;
  /** The `list=` value from a YouTube playlist URL, e.g. `PLxxxxxxxx`. */
  youtubePlaylistId?: string;
  /** Fallback for a hand-picked handful of tracks: raw YouTube video IDs. */
  videoIds?: string[];
  /** Two or three words shown as a tag on the playlist chip. */
  mood?: string;
}

export interface VibeColors {
  /** Headline / primary action colour. */
  primary: string;
  /** Supporting colour, used for secondary text and strokes. */
  secondary: string;
  /** High-energy highlight — progress bars, live dots, focus rings. */
  accent: string;
  /** Page base. */
  background: string;
  /** Second stop of the base gradient. */
  backgroundAlt: string;
  /** Panels, cards, the player bar. */
  surface: string;
  /** Body text. */
  text: string;
  /** De-emphasised text. */
  muted: string;
  /** Hairlines and dividers. */
  border: string;
  /** Colour used for bloom/shadow effects. */
  glow: string;
}

export interface VibeTypography {
  /** CSS font stack for headings. */
  heading?: string;
  /** CSS font stack for body copy. */
  body?: string;
  /** CSS font stack for LED boards, tickets and terminals. */
  mono?: string;
  /** Extra letter-spacing applied to display headings, e.g. `0.02em`. */
  headingTracking?: string;
}

export interface VibeBackground {
  type: 'gradient' | 'radial' | 'mesh';
  /** Any valid CSS `background-image` value. */
  gradient?: string;
  /** Optional extra layer painted above the gradient (e.g. a soft vignette). */
  overlay?: string;
}

export interface VibeHero {
  /** Small line above the title — e.g. "NEXT STATION". */
  kicker: string;
  title: string;
  subtitle: string;
  /**
   * Which central visual to render. Resolved through the registry in
   * `src/components/visuals/registry.ts`. An unknown id falls back to a
   * generic colour-driven visual, so a new theme never renders blank.
   */
  visual: string;
}

/** One row of the little stats panel (`CHAI LEVEL ████████░░`). */
export interface VibeStat {
  label: string;
  value: string;
  /** 0–1. When present a meter bar is drawn instead of plain text. */
  meter?: number;
}

/** A small key/value chip in the status bar. */
export interface VibeHudItem {
  label: string;
  value: string;
}

/**
 * Ambient layers to switch on for this vibe. Keys map to components in
 * `src/components/effects/registry.ts`; unknown keys are ignored, so adding a
 * new effect is additive and never breaks existing themes.
 */
export interface VibeEffects {
  grain?: boolean;
  scanlines?: boolean;
  vignette?: boolean;
  /** Slow floating dust motes caught in lamp light. */
  dust?: boolean;
  /** Rain running down glass. */
  rain?: boolean;
  /** Streaking tunnel lights passing a metro window. */
  tunnelLights?: boolean;
  /** Parallax scenery band for train windows. */
  landscape?: boolean;
  /** Road markings and streetlight smears. */
  traffic?: boolean;
  /** Slow-turning ceiling-fan shadow. */
  fanShadow?: boolean;
  /** Soft daylight shafts. */
  daylight?: boolean;
  /** Drifting city haze. */
  haze?: boolean;
}

export interface VibeSeo {
  /** Document title used while this vibe is active. */
  title: string;
  description: string;
}

export interface VibeTheme {
  id: string;
  name: string;
  /** Compact label for chips and the mobile player. */
  shortName: string;
  /** One line, shown on the mode card. */
  description: string;
  /**
   * The mode's mark. A line icon, deliberately — emoji render as a different
   * typeface on every platform and pull the whole interface toward looking
   * like a toy.
   */
  icon: LucideIcon;
  /** Extra ids that should resolve to this theme, for old or misspelt links. */
  aliases?: string[];

  colors: VibeColors;
  typography?: VibeTypography;
  background: VibeBackground;
  hero: VibeHero;

  playlists: VibePlaylist[];
  quotes: string[];

  /** Optional flavour blocks — every one of these is safe to omit. */
  stats?: VibeStat[];
  hud?: VibeHudItem[];
  /** Terminal-style lines, e.g. `> SOFTWARE: debugging...`. */
  ticker?: string[];
  effects?: VibeEffects;
  seo?: VibeSeo;
}
