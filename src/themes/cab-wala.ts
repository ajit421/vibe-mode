import { Car } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { playlistsFor } from '@/music/playlists';

export const cabWala: VibeTheme = {
  id: 'cab-wala',
  name: 'Cab Wala',
  shortName: 'Cab',
  description: 'Back seat, wet glass, the city smearing past at 1am.',
  emoji: '🚕',
  icon: Car,
  aliases: ['cab', 'taxi', 'ride'],

  colors: {
    primary: '#e879f9',
    secondary: '#38bdf8',
    accent: '#fde047',
    background: '#050409',
    backgroundAlt: '#0f0a1c',
    surface: '#100b1d',
    text: '#f1ecff',
    muted: '#9e93b9',
    border: '#211935',
    glow: '#e879f9',
  },

  typography: {
    heading: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
    body: 'Inter, "Segoe UI", system-ui, sans-serif',
    mono: '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace',
    headingTracking: '-0.01em',
  },

  background: {
    type: 'gradient',
    gradient:
      'radial-gradient(100% 75% at 82% 12%, rgba(232,121,249,0.18) 0%, transparent 58%),' +
      'radial-gradient(90% 70% at 12% 88%, rgba(56,189,248,0.16) 0%, transparent 62%),' +
      'linear-gradient(180deg, #100a1e 0%, #07050e 58%, #040308 100%)',
    overlay: 'radial-gradient(125% 95% at 50% 40%, transparent 42%, rgba(0,0,0,0.65) 100%)',
  },

  hero: {
    kicker: 'TRIP IN PROGRESS · 12.4 KM',
    title: 'CAB WALA',
    subtitle: 'Destination: somewhere. ETA: doesn’t matter. Music: matters.',
    visual: 'cab-window',
  },

  playlists: playlistsFor('cab-wala'),

  quotes: [
    'Bhaiya AC chala do.',
    'Left le lena, bas yahin.',
    'Cash? Nahi, online kar diya.',
    'Ek gaana aur, phir ghar.',
    'City looks better at 1am.',
    'Driver bhaiya ka gaana bhi acha hai.',
    'Signal red hai. Koi baat nahi.',
    'Baarish mein shehar chamakta hai.',
    'Long route le lo, gaana khatam nahi hua.',
  ],

  stats: [
    { label: 'DISTANCE', value: '12.4 km' },
    { label: 'ETA', value: 'Doesn’t matter' },
    { label: 'FARE', value: 'Surge, obviously' },
    { label: 'TRAFFIC', value: 'Heavy', meter: 0.78 },
    { label: 'PHONE BATTERY', value: '22%', meter: 0.22 },
  ],

  hud: [
    { label: 'DRIVER', value: '5 min away (10)' },
    { label: 'ROUTE', value: 'The long way' },
    { label: 'AC', value: 'Full blast' },
  ],

  ticker: [
    '> Rerouting…',
    '> Traffic ahead. Music unaffected.',
    '> Three left turns to nowhere in particular.',
    '> Arriving in 6 minutes. Song has 4 minutes left. Do the math.',
    '> Wipers on. Volume up.',
  ],

  effects: { traffic: true, rain: true, vignette: true, grain: true, haze: true },

  seo: {
    title: 'Cab Wala — The City at 1am, With Your Own Soundtrack.',
    description:
      'Rain on the window, streetlights smearing past, a route line crawling across the map. Headphones in.',
  },
};
