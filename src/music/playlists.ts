import type { VibePlaylist } from '@/types/theme';

/* ══════════════════════════════════════════════════════════════════════════
 *  PLAYLIST CONFIGURATION  —  this is the only file you need to edit to
 *  point the site at your own music.
 *
 *  HOW TO GET A PLAYLIST ID
 *  ────────────────────────
 *  Open your playlist on YouTube. The URL looks like:
 *
 *      https://www.youtube.com/playlist?list=PLb8zHNlPrRVJx9K2mHy0uzZ
 *                                            └──────── this bit ────────┘
 *
 *  Paste that value into `youtubePlaylistId` below. It usually starts with
 *  `PL` (a normal playlist), `OLAK5uy_` (an album) or `RD` (a radio mix).
 *
 *  IMPORTANT: the playlist must be Public or Unlisted. Private playlists
 *  cannot be embedded and the player will show an error state.
 *
 *  NO PLAYLIST YET?
 *  ────────────────
 *  Leave `youtubePlaylistId` empty and use `videoIds` instead — a plain list
 *  of video IDs (the `v=` part of a watch URL) works just as well:
 *
 *      videoIds: ['dQw4w9WgXcQ', 'jNQXAC9IVRw'],
 *
 *  You can also paste a playlist ID at runtime from the in-app Settings
 *  panel (⚙ in the top bar). That override is stored in localStorage and is
 *  handy for trying a playlist out before committing it to this file.
 *
 *  Anything left unconfigured degrades gracefully: the mode still looks and
 *  behaves correctly, the player just says the playlist needs setting up.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Optional per-deploy overrides from `.env` — see `.env.example`.
 * These are read with static property access so Vite inlines them at build
 * time. Anything left blank falls through to the values defined below.
 */
const ENV_OVERRIDES: Record<string, string | undefined> = {
  'judaad-night': import.meta.env.VITE_PLAYLIST_JUDAAD_NIGHT,
  'judaad-chai': import.meta.env.VITE_PLAYLIST_JUDAAD_CHAI,
  'metro-vibes': import.meta.env.VITE_PLAYLIST_METRO_VIBES,
  'metro-rush': import.meta.env.VITE_PLAYLIST_METRO_RUSH,
  'train-window': import.meta.env.VITE_PLAYLIST_TRAIN_WINDOW,
  'train-night': import.meta.env.VITE_PLAYLIST_TRAIN_NIGHT,
  'cab-night': import.meta.env.VITE_PLAYLIST_CAB_NIGHT,
  'cab-rain': import.meta.env.VITE_PLAYLIST_CAB_RAIN,
  'office-focus': import.meta.env.VITE_PLAYLIST_OFFICE_FOCUS,
  'office-lunch': import.meta.env.VITE_PLAYLIST_OFFICE_LUNCH,
};

/**
 * Playlists grouped by theme id. Adding a new theme? Add a matching key here
 * (or pass playlists inline in the theme file — `playlistsFor` returns an
 * empty array for unknown ids rather than throwing).
 */
export const PLAYLISTS: Record<string, VibePlaylist[]> = {
  'judaad-house': [
    {
      id: 'judaad-night',
      name: 'Judaad House Nights',
      description: '2am. Everyone is “almost done”.',
      mood: 'Late night',
      youtubePlaylistId: '',
    },
    {
      id: 'judaad-chai',
      name: 'Chai + Engineering',
      description: 'Sunday morning, cleaning the room that will be messy by evening.',
      mood: 'Warm',
      youtubePlaylistId: '',
    },
  ],

  metro: [
    {
      id: 'metro-vibes',
      name: 'Metro Vibes',
      description: 'Eleven minutes of tunnel and nobody needing anything.',
      mood: 'Motion',
      youtubePlaylistId: '',
    },
    {
      id: 'metro-rush',
      name: 'Rush Hour Escape',
      description: 'For when there is no seat and no space either.',
      mood: 'Loud',
      youtubePlaylistId: '',
    },
  ],

  'indian-train': [
    {
      id: 'train-window',
      name: 'Window Seat',
      description: 'Fields, poles, a river you did not know the name of.',
      mood: 'Golden hour',
      youtubePlaylistId: '',
    },
    {
      id: 'train-night',
      name: 'Upper Berth, Lights Off',
      description: 'The coach is asleep. You are not.',
      mood: 'Quiet',
      youtubePlaylistId: '',
    },
  ],

  'cab-wala': [
    {
      id: 'cab-night',
      name: 'Backseat at 1AM',
      description: 'Streetlights doing that thing they do.',
      mood: 'Neon',
      youtubePlaylistId: '',
    },
    {
      id: 'cab-rain',
      name: 'Rain on the Window',
      description: 'Wipers keeping time with the track.',
      mood: 'Rainy',
      youtubePlaylistId: '',
    },
  ],

  office: [
    {
      id: 'office-focus',
      name: 'Deep Work',
      description: 'No lyrics, no notifications, no meetings.',
      mood: 'Focus',
      youtubePlaylistId: '',
    },
    {
      id: 'office-lunch',
      name: 'Post-Lunch Recovery',
      description: 'The 3pm slump has a soundtrack.',
      mood: 'Easy',
      youtubePlaylistId: '',
    },
  ],
};

/**
 * Returns the playlists for a theme with any `.env` overrides applied.
 * Unknown theme ids return an empty array — never throws.
 */
export function playlistsFor(themeId: string): VibePlaylist[] {
  const list = PLAYLISTS[themeId];
  if (!list) return [];

  return list.map((playlist) => {
    const override = ENV_OVERRIDES[playlist.id]?.trim();
    return override ? { ...playlist, youtubePlaylistId: override } : playlist;
  });
}
