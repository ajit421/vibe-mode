import { Home } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { playlistsFor } from '@/music/playlists';

export const judaadHouse: VibeTheme = {
  id: 'judaad-house',
  name: 'Judaad House',
  shortName: 'House',
  description: 'Rented room, three engineers, one extension board doing all the work.',
  icon: Home,
  aliases: ['jugaad-house', 'house', 'home'],

  colors: {
    primary: '#f5a524',
    secondary: '#5eead4',
    accent: '#86efac',
    background: '#0c0a09',
    backgroundAlt: '#1b1411',
    surface: '#16110e',
    text: '#f6f1e8',
    muted: '#a8a096',
    border: '#2c231d',
    glow: '#f5a524',
  },

  typography: {
    heading: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
    body: 'Inter, "Segoe UI", system-ui, sans-serif',
    mono: '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace',
    headingTracking: '-0.02em',
  },

  background: {
    type: 'radial',
    gradient:
      'radial-gradient(120% 90% at 18% 8%, rgba(245,165,36,0.20) 0%, transparent 55%),' +
      'radial-gradient(90% 70% at 88% 92%, rgba(94,234,212,0.10) 0%, transparent 60%),' +
      'linear-gradient(168deg, #16100c 0%, #0c0a09 55%, #0a0908 100%)',
    overlay: 'radial-gradient(130% 100% at 50% 0%, transparent 40%, rgba(0,0,0,0.55) 100%)',
  },

  hero: {
    kicker: '3 ENGINEERS · 1 HOUSE · 0 PROPER SOLUTIONS',
    title: 'JUDAAD HOUSE',
    visual: 'judaad-desk',
  },

  playlists: playlistsFor('judaad-house'),

  quotes: [
    'Bhai jugaad ho jayega.',
    'Kal karenge. Pakka.',
    'Ek baar aur test kar.',
    'Chai bana?',
    'Ye temporary fix hai.',
    'Temporary fixes that survived six months.',
    'Production mein chal raha hai, don’t touch it.',
    'Bhai ye wire kidhar ja raha hai?',
    'Ek baar restart karke dekh.',
    'Extension board pe aur kuch mat lagana.',
    '5 minute aur, phir sote hain.',
    'Warranty toh kab ki gayi.',
  ],

  stats: [
    { label: 'ROOMMATES', value: '03' },
    { label: 'ENGINEERS', value: '03' },
    { label: 'PROPER SOLUTIONS', value: '00' },
    { label: 'CHAI LEVEL', value: 'Critical', meter: 0.85 },
    { label: 'SLEEP LEVEL', value: 'Low', meter: 0.18 },
  ],

  hud: [
    { label: 'RENT', value: 'Split 3 ways' },
    { label: 'WI-FI', value: 'Stable-ish' },
    { label: 'DEADLINE', value: 'Kal' },
  ],

  ticker: [
    '> SOFTWARE: debugging since 2am…',
    '> MECHANICAL: “ye toh design flaw hai”',
    '> ELECTRICAL: checking voltage… 240V confirmed',
    '> ALL: chai break',
    '> SOFTWARE: it works on my laptop',
    '> MECHANICAL: tolerance ±5mm, chalega',
    '> ELECTRICAL: don’t touch the blue wire',
  ],

  effects: { grain: true, vignette: true, dust: true, fanShadow: true },

  seo: {
    title: 'Judaad House — Three Engineers. One House. Infinite Jugaad.',
    description:
      'A late-night rented room, a desk full of half-finished projects and the playlist that survived all of it.',
  },
};
