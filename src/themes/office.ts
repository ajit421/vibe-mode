import { Briefcase } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { playlistsFor } from '@/music/playlists';

export const office: VibeTheme = {
  id: 'office',
  name: 'Office Mode',
  shortName: 'Office',
  description: 'Second monitor, third coffee, one tab that is actually work.',
  emoji: '💼',
  icon: Briefcase,
  aliases: ['work', 'desk'],

  colors: {
    primary: '#7dd3fc',
    secondary: '#a5b4fc',
    accent: '#4ade80',
    background: '#0a0f16',
    backgroundAlt: '#141d29',
    surface: '#101822',
    text: '#e7eef6',
    muted: '#8b9cb0',
    border: '#1d2836',
    glow: '#7dd3fc',
  },

  typography: {
    heading: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
    body: 'Inter, "Segoe UI", system-ui, sans-serif',
    mono: '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace',
    headingTracking: '-0.015em',
  },

  background: {
    type: 'gradient',
    gradient:
      'radial-gradient(95% 70% at 78% 6%, rgba(125,211,252,0.16) 0%, transparent 58%),' +
      'radial-gradient(80% 60% at 8% 95%, rgba(165,180,252,0.10) 0%, transparent 60%),' +
      'linear-gradient(176deg, #131d29 0%, #0b1119 58%, #080d13 100%)',
    overlay: 'radial-gradient(125% 95% at 50% 0%, transparent 48%, rgba(0,0,0,0.5) 100%)',
  },

  hero: {
    kicker: 'STATUS: WORKING · DO NOT DISTURB',
    title: 'OFFICE MODE',
    subtitle: 'Productivity: questionable. Music: required.',
    visual: 'office-desk',
  },

  playlists: playlistsFor('office'),

  quotes: [
    'Ek meeting aur.',
    'This could have been an email.',
    'Lunch kya hai?',
    'Kal deploy karenge.',
    'Ctrl+S. Always Ctrl+S.',
    'Just one more ticket.',
    'Camera off, headphones on.',
    'Standup mein bolna kya hai?',
    '“Quick sync” — forty minutes later.',
  ],

  stats: [
    { label: 'MEETINGS TODAY', value: '04' },
    { label: 'FOCUS BLOCKS', value: '00' },
    { label: 'UNREAD', value: '127' },
    { label: 'FOCUS', value: 'Fragile', meter: 0.35 },
    { label: 'COFFEE', value: 'Third cup', meter: 0.9 },
  ],

  hud: [
    { label: 'BUILD', value: 'Passing' },
    { label: 'STANDUP', value: 'In 8 min' },
    { label: 'STATUS', value: 'Do not disturb' },
  ],

  ticker: [
    '> git commit -m "final final v2"',
    '> Deploy at 5pm on a Friday? Bold.',
    '> 14 tabs of documentation. 0 read.',
    '> Standup in 8 minutes. Camera off.',
    '> Tests passing locally. That counts.',
  ],

  effects: { daylight: true, grain: true, vignette: true },

  seo: {
    title: 'Office Mode — Headphones On, Notifications Off.',
    description:
      'A calm desk, a clean editor and a playlist that keeps the open-plan office out of your head.',
  },
};
