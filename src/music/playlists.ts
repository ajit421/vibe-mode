import type { VibePlaylist } from '@/types/theme';

/* ══════════════════════════════════════════════════════════════════════════
 *  PLAYLIST CONFIGURATION
 *
 *  ⚠️  NO YOUTUBE IDs IN THIS FILE. EVER.
 *
 *  This file describes *what* each playlist is — its name, blurb and mood.
 *  What it actually plays is a `playlist` row in the `defaults` table in D1,
 *  keyed by the playlist `id` below and served by `/api/config` (see
 *  `themes/defaults.ts`). The type below makes pasting an ID here a compile
 *  error rather than a convention, so it cannot drift.
 *
 *  The row's value is a playlist id or link (Public or Unlisted — private
 *  ones cannot be embedded), or one or more video ids or links, comma-separated.
 *
 *  Listeners can relink, rename or remove any playlist from the in-app
 *  Customize panel (palette icon in the top bar). That is stored in their
 *  browser only and wins over the default; emptying the link goes back to it.
 *
 *  Anything left unset degrades gracefully: the mode still looks and behaves
 *  correctly, and the player says the playlist isn't set up yet.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * A playlist as described in code — deliberately without any ID field, so
 * TypeScript rejects an attempt to paste one in here.
 */
export type PlaylistDefinition = Omit<VibePlaylist, 'youtubePlaylistId' | 'videoIds'>;

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
 * A theme's playlists, as described here — what they play is filled in at
 * runtime from the site's defaults. Unknown theme ids return an empty array.
 */
export function playlistsFor(themeId: string): VibePlaylist[] {
  return PLAYLISTS[themeId] ?? [];
}
