import { CarFront } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { playlistsFor } from '@/music/playlists';

export const gadiWala: VibeTheme = {
  id: 'gadi-wala',
  name: 'Gadi Wala',
  shortName: 'Gadi',
  description: 'Koi bhi gadi, full volume, sirf famous gaane.',
  icon: CarFront,
  aliases: ['gadi', 'car', 'roadtrip'],

  colors: {
    primary: '#ff5da2',
    secondary: '#2dd4bf',
    accent: '#facc15',
    background: '#080611',
    backgroundAlt: '#1b1033',
    surface: '#140d26',
    text: '#f7f1ff',
    muted: '#a597c6',
    border: '#281b48',
    glow: '#ff5da2',
  },

  typography: {
    heading: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
    body: 'Inter, "Segoe UI", system-ui, sans-serif',
    mono: '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace',
    headingTracking: '0.02em',
  },

  background: {
    type: 'gradient',
    gradient:
      'radial-gradient(105% 78% at 22% 10%, rgba(255,93,162,0.20) 0%, transparent 56%),' +
      'radial-gradient(95% 70% at 85% 88%, rgba(45,212,191,0.16) 0%, transparent 62%),' +
      'linear-gradient(180deg, #1b1033 0%, #0a0718 58%, #060410 100%)',
    overlay: 'radial-gradient(125% 95% at 50% 40%, transparent 44%, rgba(0,0,0,0.6) 100%)',
  },

  hero: {
    kicker: 'HORN OK PLEASE · VOLUME 100',
    title: 'GADI WALA',
    subtitle: 'Koi bhi gadi. Full volume. Sirf famous gaane.',
    visual: 'gadi-stereo',
  },

  playlists: playlistsFor('gadi-wala'),

  quotes: [
    'Ye gaana toh sabko aata hai.',
    'Bass thoda aur badha bhai.',
    'Window neeche karo.',
    'Isko repeat pe daal do.',
    'Poori gadi gaa rahi hai.',
    'Highway pe hi maza hai.',
    'Peeche wali seat pe concert chal raha hai.',
    'Petrol khatam, playlist nahi.',
    'Driver bhaiya ne bhi gaana gaaya.',
  ],

  stats: [
    { label: 'SPEED', value: '80 km/h' },
    { label: 'SPEAKERS', value: '06' },
    { label: 'VOLUME', value: 'Maximum', meter: 1 },
    { label: 'BASS', value: 'Too much', meter: 0.95 },
    { label: 'NEIGHBOURS', value: 'Annoyed', meter: 0.88 },
  ],

  hud: [
    { label: 'HORN', value: 'OK Please' },
    { label: 'WINDOWS', value: 'Down' },
    { label: 'SUNROOF', value: 'Nahi hai' },
  ],

  ticker: [
    '> Bass thoda aur badha',
    '> Ye gaana sabko aata hai — sab gaa rahe hain',
    '> Speed breaker aa raha hai… volume kam mat karna',
    '> Petrol 40% · Playlist 100%',
    '> Peeche wali seat pe dance chal raha hai',
  ],

  effects: { traffic: true, grain: true, vignette: true, haze: true },

  seo: {
    title: 'Gadi Wala — Full Volume, Sab Gaane Famous.',
    description:
      'Any car, six speakers, windows down and a playlist every single passenger already knows.',
  },
};
