import { TramFront } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { playlistsFor } from '@/music/playlists';

export const indianTrain: VibeTheme = {
  id: 'indian-train',
  name: 'Indian Train',
  shortName: 'Train',
  description: 'Window seat, fields going by, chai every forty minutes.',
  icon: TramFront,
  aliases: ['train', 'railway'],

  colors: {
    primary: '#e8b04b',
    secondary: '#8fb573',
    accent: '#e07a5f',
    background: '#0e0c09',
    backgroundAlt: '#241b13',
    surface: '#191309',
    text: '#f4ebda',
    muted: '#b3a590',
    border: '#352a1e',
    glow: '#e8b04b',
  },

  typography: {
    heading: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
    body: 'Inter, "Segoe UI", system-ui, sans-serif',
    mono: '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace',
    headingTracking: '0.04em',
  },

  background: {
    type: 'gradient',
    gradient:
      'radial-gradient(110% 80% at 72% 12%, rgba(232,176,75,0.22) 0%, transparent 58%),' +
      'radial-gradient(90% 70% at 15% 90%, rgba(143,181,115,0.10) 0%, transparent 62%),' +
      'linear-gradient(172deg, #241a11 0%, #120e09 55%, #0c0a07 100%)',
    overlay: 'radial-gradient(130% 100% at 50% 10%, transparent 42%, rgba(0,0,0,0.58) 100%)',
  },

  hero: {
    kicker: 'INDIAN RAILWAYS · 12951 · PLATFORM 07',
    title: 'WINDOW SEAT',
    visual: 'train-window',
  },

  playlists: playlistsFor('indian-train'),

  quotes: [
    'Window seat mil gayi.',
    'Chai le lo, garam hai.',
    'Ye kaunsa station tha?',
    'Charging point kaam kar raha hai!',
    'Upar wali berth khaali hai.',
    'Abhi bees minute late hai, matlab time pe hai.',
    'Sunset ke time hi acche gaane bajte hain.',
    'Pantry wala fir se aa gaya.',
    'Bahar dekhte raho, kuch nahi karna.',
  ],

  stats: [
    { label: 'TRAIN NO.', value: '12951' },
    { label: 'COACH', value: 'B4' },
    { label: 'BERTH', value: '32 · SIDE LOWER' },
    { label: 'CHAI COUNT', value: '04', meter: 0.7 },
    { label: 'RUNNING LATE', value: '40 min', meter: 0.4 },
  ],

  hud: [
    { label: 'PANTRY', value: '2 coaches away' },
    { label: 'DELAY', value: 'Only 40 min' },
    { label: 'WINDOW', value: 'Open' },
  ],

  ticker: [
    '> Chai! Chai! Chai garam!',
    '> Next halt: somewhere with a good view',
    '> Samosa? Kachori? Chai?',
    '> Please do not lean out of the window.',
    '> Attention: this train is running 40 minutes late, as tradition demands.',
  ],

  effects: { grain: true, vignette: true, dust: true },

  seo: {
    title: 'Indian Train — Window Seat, Chai and a Long Way to Go.',
    description:
      'Fields sliding past a barred window, a paper ticket in your pocket, and hours of music with nowhere to be.',
  },
};
