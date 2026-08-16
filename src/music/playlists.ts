import type { VibePlaylist } from '@/types/theme';

/* ══════════════════════════════════════════════════════════════════════════
 *  PLAYLIST CONFIGURATION
 *
 *  ⚠️  NO YOUTUBE IDs IN THIS FILE. EVER.
 *
 *  This file describes *what* each playlist is — its name, blurb and mood.
 *  The actual YouTube ID always comes from `.env`. The type below makes that
 *  a compile error rather than a convention, so it cannot drift.
 *
 *  ── Where the ID comes from ──────────────────────────────────────────────
 *  The env variable name is derived from the playlist `id`:
 *
 *      id: 'metro-vibes'   →   VITE_PLAYLIST_METRO_VIBES
 *      id: 'gadi-hits'     →   VITE_PLAYLIST_GADI_HITS
 *
 *  So adding a playlist here needs no wiring at all — just add the matching
 *  line to `.env` (and to `.env.example` so the next person knows about it).
 *
 *  ── What goes in .env ────────────────────────────────────────────────────
 *      VITE_PLAYLIST_METRO_VIBES=PLb8zHNlPrRVJx9K2mHy0uzZ
 *
 *  Take that value from the playlist URL:
 *
 *      https://www.youtube.com/playlist?list=PLb8zHNlPrRVJx9K2mHy0uzZ
 *                                            └──────── this bit ────────┘
 *
 *  The playlist must be Public or Unlisted — private ones cannot be embedded.
 *
 *  A comma-separated value is treated as individual videos instead, which is
 *  useful before you have made a real playlist:
 *
 *      VITE_PLAYLIST_METRO_VIBES=dQw4w9WgXcQ,jNQXAC9IVRw
 *
 *  ── Overriding without touching anything ─────────────────────────────────
 *  Listeners can point any playlist somewhere else from the in-app Settings
 *  panel (⚙ in the top bar). That is stored in their browser only and always
 *  wins over `.env`; clearing the field falls back to the `.env` default.
 *
 *  Anything left unset degrades gracefully: the mode still looks and behaves
 *  correctly, and the player explains exactly which variable is missing.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * A playlist as described in code — deliberately without any ID field, so
 * TypeScript rejects an attempt to paste one in here.
 */
export type PlaylistDefinition = Omit<VibePlaylist, 'youtubePlaylistId' | 'videoIds'>;

/**
 * Vite inlines the whole `import.meta.env` object at build time, not just the
 * property accesses it can see, so looking a key up dynamically is safe and
 * lets the variable name be derived from the playlist id.
 */
const ENV = import.meta.env as unknown as Record<string, string | undefined>;

/** `'metro-vibes'` → `'VITE_PLAYLIST_METRO_VIBES'`. */
export function envVarFor(playlistId: string): string {
  return `VITE_PLAYLIST_${playlistId.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;
}

function readEnvValue(playlistId: string): string | undefined {
  const value = ENV[envVarFor(playlistId)]?.trim();
  return value ? value : undefined;
}

/**
 * Playlists grouped by theme id. Adding a new theme? Add a matching key here.
 * `playlistsFor` returns an empty array for unknown ids rather than throwing.
 */
export const PLAYLISTS: Record<string, PlaylistDefinition[]> = {
  'judaad-house': [
    {
      id: 'judaad-night',
      name: 'Judaad House Nights',
      description: '2am. Everyone is “almost done”.',
      mood: 'Late night',
    },
    {
      id: 'judaad-chai',
      name: 'Chai + Engineering',
      description: 'Sunday morning, cleaning the room that will be messy by evening.',
      mood: 'Warm',
    },
  ],

  metro: [
    {
      id: 'metro-vibes',
      name: 'Metro Vibes',
      description: 'Eleven minutes of tunnel and nobody needing anything.',
      mood: 'Motion',
    },
    {
      id: 'metro-rush',
      name: 'Rush Hour Escape',
      description: 'For when there is no seat and no space either.',
      mood: 'Loud',
    },
  ],

  'indian-train': [
    {
      id: 'train-window',
      name: 'Window Seat',
      description: 'Fields, poles, a river you did not know the name of.',
      mood: 'Golden hour',
    },
    {
      id: 'train-night',
      name: 'Upper Berth, Lights Off',
      description: 'The coach is asleep. You are not.',
      mood: 'Quiet',
    },
  ],

  'cab-wala': [
    {
      id: 'cab-night',
      name: 'Backseat at 1AM',
      description: 'Streetlights doing that thing they do.',
      mood: 'Neon',
    },
    {
      id: 'cab-rain',
      name: 'Rain on the Window',
      description: 'Wipers keeping time with the track.',
      mood: 'Rainy',
    },
  ],

  office: [
    {
      id: 'office-focus',
      name: 'Deep Work',
      description: 'No lyrics, no notifications, no meetings.',
      mood: 'Focus',
    },
    {
      id: 'office-lunch',
      name: 'Post-Lunch Recovery',
      description: 'The 3pm slump has a soundtrack.',
      mood: 'Easy',
    },
  ],

  'radio-wala': [
    {
      id: 'radio-retro',
      name: 'Purane Gaane',
      description: 'The ones your parents still know every word of.',
      mood: 'Retro',
    },
    {
      id: 'radio-latenight',
      name: 'Late Night Farmaish',
      description: 'Requests, dedications and a little static.',
      mood: 'Slow',
    },
  ],

  'gadi-wala': [
    {
      id: 'gadi-hits',
      name: 'Sabke Favourite',
      description: 'Every single person in the car knows this one.',
      mood: 'Loud',
    },
    {
      id: 'gadi-highway',
      name: 'Highway Pe Full Volume',
      description: 'Windows down, bass up, nobody navigating.',
      mood: 'Highway',
    },
  ],

  college: [
    {
      id: 'college-vibes',
      name: 'Backbench Playlist',
      description: 'One earphone for you, one for the guy next to you.',
      mood: 'Nostalgic',
    },
    {
      id: 'college-canteen',
      name: 'Canteen Wali Table',
      description: 'Forty rupees, four people, two hours.',
      mood: 'Timepass',
    },
  ],
};

/**
 * Returns a theme's playlists with the IDs from `.env` filled in.
 * Unknown theme ids return an empty array — never throws.
 */
export function playlistsFor(themeId: string): VibePlaylist[] {
  const list = PLAYLISTS[themeId];
  if (!list) return [];

  return list.map((playlist) => {
    const value = readEnvValue(playlist.id);
    if (!value) return playlist;

    // Commas mean a hand-picked set of videos rather than a playlist.
    if (value.includes(',')) {
      const videoIds = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      return { ...playlist, videoIds };
    }

    return { ...playlist, youtubePlaylistId: value };
  });
}
