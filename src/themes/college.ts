import { GraduationCap } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { playlistsFor } from '@/music/playlists';

export const college: VibeTheme = {
  id: 'college',
  name: 'College Wala',
  shortName: 'College',
  description: 'Last bench, attendance 61%, one earphone each.',
  emoji: '🎓',
  icon: GraduationCap,
  aliases: ['clg', 'campus'],

  colors: {
    primary: '#f0a52c',
    secondary: '#6ee7b7',
    accent: '#7dd3fc',
    background: '#090d0a',
    backgroundAlt: '#16241a',
    surface: '#101913',
    text: '#f3f5ec',
    muted: '#9aab9c',
    border: '#213021',
    glow: '#f0a52c',
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
      'radial-gradient(105% 80% at 78% 10%, rgba(240,165,44,0.18) 0%, transparent 56%),' +
      'radial-gradient(90% 68% at 10% 90%, rgba(110,231,183,0.10) 0%, transparent 62%),' +
      'linear-gradient(172deg, #16241a 0%, #0b110c 58%, #080c09 100%)',
    overlay: 'radial-gradient(130% 100% at 50% 6%, transparent 44%, rgba(0,0,0,0.55) 100%)',
  },

  hero: {
    kicker: 'SEMESTER 5 · LAST BENCH · 4TH PERIOD',
    title: 'COLLEGE WALA',
    subtitle: 'Attendance short. Playlist full.',
    visual: 'college-desk',
  },

  playlists: playlistsFor('college'),

  quotes: [
    'Attendance?',
    'Proxy laga dena.',
    'Kal se pakka padhai.',
    'Canteen chalein?',
    'Notes kisi ke paas hain?',
    'Ye syllabus mein tha?',
    'Last bench, best bench.',
    'Ek earphone tu le, ek main.',
    'Practical file kal bana lenge.',
    'Sir ne kya padhaya? Pata nahi.',
  ],

  stats: [
    { label: 'ATTENDANCE', value: '61%', meter: 0.61 },
    { label: 'BACKLOGS', value: '02' },
    { label: 'ASSIGNMENTS DUE', value: '03' },
    { label: 'MOTIVATION', value: 'Missing', meter: 0.18 },
    { label: 'CANTEEN BUDGET', value: '₹40', meter: 0.25 },
  ],

  hud: [
    { label: 'PERIOD', value: '4th' },
    { label: 'CANTEEN', value: 'Open' },
    { label: 'PROXY', value: 'Lag gaya' },
  ],

  ticker: [
    '> Proxy bol dena, main aa raha hoon',
    '> Submission kal hai. Aaj nahi.',
    '> Attendance 61% — 14 aur classes chahiye',
    '> Chalo canteen, ye lecture bekaar hai',
    '> Sir ne kaha ye important hai. Har baar kehte hain.',
  ],

  effects: { grain: true, vignette: true, daylight: true, dust: true },

  seo: {
    title: 'College Wala — Last Bench, Best Bench.',
    description:
      'A carved wooden desk, a notebook full of doodles, one earphone each and 61% attendance.',
  },
};
