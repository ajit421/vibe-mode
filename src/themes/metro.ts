import { TrainFront } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { playlistsFor } from '@/music/playlists';

export const metro: VibeTheme = {
  id: 'metro',
  name: 'Metro Mode',
  shortName: 'Metro',
  description: 'Tunnel lights, a seat you did not expect, eleven minutes to yourself.',
  emoji: '🚇',
  icon: TrainFront,
  aliases: ['subway'],

  colors: {
    primary: '#38bdf8',
    secondary: '#818cf8',
    accent: '#fbbf24',
    background: '#05070e',
    backgroundAlt: '#0b1322',
    surface: '#0c1322',
    text: '#e9f0f9',
    muted: '#8ea4c0',
    border: '#182639',
    glow: '#38bdf8',
  },

  typography: {
    heading: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
    body: 'Inter, "Segoe UI", system-ui, sans-serif',
    mono: '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace',
    headingTracking: '0.01em',
  },

  background: {
    type: 'gradient',
    gradient:
      'radial-gradient(100% 80% at 50% 0%, rgba(56,189,248,0.16) 0%, transparent 60%),' +
      'radial-gradient(80% 60% at 10% 100%, rgba(129,140,248,0.14) 0%, transparent 65%),' +
      'linear-gradient(180deg, #0a1120 0%, #060a13 60%, #04060c 100%)',
    overlay: 'radial-gradient(120% 90% at 50% 45%, transparent 45%, rgba(0,0,0,0.6) 100%)',
  },

  hero: {
    kicker: 'NEXT STATION: VIBE',
    title: 'METRO MODE',
    subtitle: 'Please mind the music. Doors are closing.',
    visual: 'metro-coach',
  },

  playlists: playlistsFor('metro'),

  quotes: [
    'Seat mil gayi. Jackpot.',
    'Ek stop aur.',
    'Headphones on, world off.',
    'Doors closing. Mood opening.',
    'Interchange pe uthna hai — sona mat.',
    'Card mein balance hai na?',
    'Eleven minutes of nobody needing anything.',
    'Tunnel mein network gaya, gaana chalta raha.',
    'Window ke bahar sirf apni reflection hai.',
  ],

  stats: [
    { label: 'LINE', value: 'Blue' },
    { label: 'COACH', value: '04' },
    { label: 'NEXT STATION', value: 'Vibe' },
    { label: 'CROWD', value: 'Manageable', meter: 0.62 },
    { label: 'SIGNAL', value: 'Two bars', meter: 0.34 },
  ],

  hud: [
    { label: 'DOORS', value: 'Left side' },
    { label: 'AC', value: 'Working' },
    { label: 'SEAT', value: 'Standing' },
  ],

  ticker: [
    '> Next station: Vibe. Doors will open on the left.',
    '> अगला स्टेशन: वाइब',
    '> Please stand clear of the closing doors.',
    '> Mind the gap. Mind the music.',
    '> Interchange for Nostalgia Line at the next stop.',
  ],

  effects: { tunnelLights: true, vignette: true, grain: true, haze: true },

  seo: {
    title: 'Metro Mode — Press Play and Watch the City Move.',
    description:
      'Tunnel lights streaking past the window, an LED board counting down stations, and the playlist that makes the commute worth it.',
  },
};
