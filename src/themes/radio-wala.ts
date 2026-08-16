import { Radio } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { playlistsFor } from '@/music/playlists';

export const radioWala: VibeTheme = {
  id: 'radio-wala',
  name: 'Radio Wala',
  shortName: 'Radio',
  description: 'Dial ghumao, purane gaane, thoda sa static.',
  icon: Radio,
  aliases: ['radio', 'fm', 'mirchi'],

  colors: {
    primary: '#e9a13b',
    secondary: '#c9714a',
    accent: '#7fd1ae',
    background: '#0d0906',
    backgroundAlt: '#251811',
    surface: '#1a1109',
    text: '#f8edda',
    muted: '#b19b7f',
    border: '#35251a',
    glow: '#e9a13b',
  },

  typography: {
    heading: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
    body: 'Inter, "Segoe UI", system-ui, sans-serif',
    mono: '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace',
    headingTracking: '0.05em',
  },

  background: {
    type: 'radial',
    gradient:
      'radial-gradient(115% 85% at 50% 8%, rgba(233,161,59,0.22) 0%, transparent 56%),' +
      'radial-gradient(85% 65% at 12% 92%, rgba(201,113,74,0.14) 0%, transparent 62%),' +
      'linear-gradient(170deg, #241710 0%, #100b07 55%, #0b0806 100%)',
    overlay: 'radial-gradient(130% 100% at 50% 5%, transparent 40%, rgba(0,0,0,0.6) 100%)',
  },

  hero: {
    kicker: '98.3 FM · AAPKA APNA STATION',
    title: 'RADIO WALA',
    subtitle: 'Dial ghumao. Purane gaane. Thoda sa static.',
    visual: 'radio-set',
  },

  playlists: playlistsFor('radio-wala'),

  quotes: [
    'Ye gaana toh bahut purana hai.',
    'Antenna thoda hila do.',
    'Farmaish bhej dete hain.',
    'Isko mat badalna!',
    'Volume dheere — mummy so rahi hai.',
    'Purane gaane hi acche the.',
    'Ek gaana aur, phir band.',
    'Station badal gaya, wapas ghumao.',
    'Bas thoda sa static hai, chalega.',
  ],

  stats: [
    { label: 'FREQUENCY', value: '98.3 FM' },
    { label: 'BAND', value: 'FM · AM · SW' },
    { label: 'ERA', value: '1990s' },
    { label: 'SIGNAL', value: 'Mostly clear', meter: 0.72 },
    { label: 'STATIC', value: 'Acceptable', meter: 0.28 },
  ],

  hud: [
    { label: 'RJ', value: 'On air' },
    { label: 'ANTENNA', value: 'Fully extended' },
    { label: 'REQUESTS', value: '07 pending' },
  ],

  ticker: [
    '> Aur ab, ek farmaish…',
    '> Ye gaana aapke liye — Bhopal se, Anjali ji',
    '> …thoda sa static… haan, ab theek hai',
    '> Aap sun rahe hain, sirf aapka apna radio',
    '> Iske baad, ek aur purana nagma',
  ],

  effects: { grain: true, vignette: true, dust: true, haze: true },

  seo: {
    title: 'Radio Wala — Dial Ghumao, Purane Gaane Bajao.',
    description:
      'A wooden radio set, a glowing dial and the songs your parents still know every word of.',
  },
};
