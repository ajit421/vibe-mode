# Vibe Mode

**Where are you right now?**

Five little worlds, five playlists. Pick the place you're actually in — the
rented house, the metro, a train window seat, the back of a cab, your desk —
and the whole site becomes that world: colours, typography, artwork, ambient
motion, small jokes, and the music that belongs there.

It's less a music website and more a digital memory machine.

| Mode | What it is |
| --- | --- |
| 🏠 **Judaad House** | Three engineers, one rented house, infinite jugaad |
| 🚇 **Metro** | Tunnel lights, LED board, eleven minutes to yourself |
| 🚂 **Indian Train** | Window seat, fields going by, chai every forty minutes |
| 🚕 **Cab Wala** | Back seat, wet glass, the city smearing past at 1am |
| 💼 **Office** | Second monitor, third coffee, one tab that's actually work |

---

## Contents

1. [Quick start](#quick-start)
2. [Tech stack](#tech-stack)
3. [Set up your playlists](#set-up-your-playlists) ← **start here**
4. [How to add a new theme](#how-to-add-a-new-theme)
5. [Architecture](#architecture)
6. [Deploying to Netlify](#deploying-to-netlify)
7. [Environment variables](#environment-variables)
8. [Customising further](#customising-further)
9. [Keyboard shortcuts](#keyboard-shortcuts)
10. [Sharing links](#sharing-links)
11. [Notes on YouTube](#notes-on-youtube)
12. [Accessibility & performance](#accessibility--performance)

---

## Quick start

Requires **Node 20+**.

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only, no build |
| `npm run og` | Regenerate `public/og.png`, the social preview card |

The site works immediately, but **no music will play until you add playlist
IDs** — see the next section. Every mode still looks and behaves correctly
without them; the player just tells you what's missing.

---

## Tech stack

- **React 18** + **TypeScript** (strict)
- **Vite 6** — build and dev server
- **Tailwind CSS v4** — CSS-first config, no `tailwind.config.js`
- **Motion** (`motion/react`, formerly Framer Motion) — transitions
- **Lucide React** — icons
- **YouTube IFrame Player API** — playback
- **localStorage** — preferences

No state library, no router, no UI kit. Total JS on first load is around
**112 kB gzipped**, and each mode's artwork is a separate chunk of ~3 kB
fetched only when you visit that world.

---

## Set up your playlists

Everything lives in one file: **[`src/music/playlists.ts`](src/music/playlists.ts)**.

### 1. Get a playlist ID

Open your playlist on YouTube and look at the URL:

```
https://www.youtube.com/playlist?list=PLb8zHNlPrRVJx9K2mHy0uzZ
                                      └──────── this bit ────────┘
```

That value is the playlist ID. It usually starts with `PL` (a normal
playlist), `OLAK5uy_` (an album) or `RD` (a radio mix).

> The playlist must be **Public** or **Unlisted**. Private playlists cannot be
> embedded and the player will show an error.

### 2. Paste it in

```ts
'judaad-house': [
  {
    id: 'judaad-night',
    name: 'Judaad House Nights',
    description: '2am. Everyone is “almost done”.',
    mood: 'Late night',
    youtubePlaylistId: 'PLb8zHNlPrRVJx9K2mHy0uzZ',  // ← here
  },
],
```

That's it. Reload, and the mode's playlist works.

### No playlist yet? Use individual videos

```ts
{
  id: 'judaad-night',
  name: 'Judaad House Nights',
  description: 'A few songs to start with.',
  videoIds: ['dQw4w9WgXcQ', 'jNQXAC9IVRw', '9bZkp7q19f0'],
}
```

`youtubePlaylistId` wins if both are set.

### Trying one out without editing code

Open **Settings** (⚙ in the top bar) → paste a playlist link or ID into
**YouTube playlist ID** → **Apply**. It's stored in your browser only, and
overrides the file for that one playlist. Clear the field to undo.

Handy for auditioning playlists; use the file for anything permanent.

---

## How to add a new theme

This is the part the whole architecture exists to make easy. Adding a mode is
**one new file and one line**. The mode picker, keyboard shortcut, `?mode=`
URL, SEO title, playlist wiring and colour scheme all follow automatically.

### Step 1 — create `src/themes/college.ts`

```ts
import { GraduationCap } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { playlistsFor } from '@/music/playlists';

export const college: VibeTheme = {
  id: 'college',
  name: 'College Wala',
  shortName: 'College',
  description: 'Backbench, last row, attendance short by 4%.',
  emoji: '🎓',
  icon: GraduationCap,
  aliases: ['clg'],              // optional: extra ?mode= values

  colors: {
    primary: '#f97316',
    secondary: '#a3e635',
    accent: '#22d3ee',
    background: '#0b0a08',
    backgroundAlt: '#1d1712',
    surface: '#15120e',
    text: '#f6f2ea',
    muted: '#a49b8d',
    border: '#2b241c',
    glow: '#f97316',
  },

  background: {
    type: 'gradient',
    gradient:
      'radial-gradient(110% 85% at 20% 10%, rgba(249,115,22,0.18), transparent 55%),' +
      'linear-gradient(170deg, #1a1410 0%, #0b0a08 60%)',
  },

  hero: {
    kicker: 'SEMESTER 5 · BACKBENCH',
    title: 'COLLEGE WALA',
    subtitle: 'Attendance short. Playlist full.',
    visual: 'college-classroom',   // see step 3
  },

  playlists: playlistsFor('college'),

  quotes: [
    'Attendance?',
    'Proxy laga dena.',
    'Kal se pakka padhai.',
    'Canteen chalein?',
  ],

  // Everything below is optional — omit any of it and the UI adapts.
  stats: [
    { label: 'ATTENDANCE', value: '61%', meter: 0.61 },
    { label: 'ASSIGNMENTS DUE', value: '03' },
    { label: 'MOTIVATION', value: 'Low', meter: 0.2 },
  ],
  hud: [
    { label: 'PERIOD', value: '4th' },
    { label: 'CANTEEN', value: 'Open' },
  ],
  ticker: ['> Proxy bol dena', '> Submission kal hai'],
  effects: { grain: true, vignette: true, dust: true },
  seo: {
    title: 'College Wala — Backbench Memories.',
    description: 'Last row, last bench, best playlist.',
  },
};
```

### Step 2 — register it in `src/themes/index.ts`

```ts
import { college } from './college';

export const THEMES: readonly VibeTheme[] = [
  judaadHouse, metro, indianTrain, cabWala, office,
  college,                                            // ← added
];
```

**The theme is now live.** It appears in the picker, gets keyboard shortcut
`6`, responds to `?mode=college`, and shows a themed abstract visual built
from its own palette.

### Step 3 (optional) — give it artwork

Unknown `hero.visual` ids fall back to `AbstractVisual`, so this is genuinely
optional. To draw a real scene:

1. Create `src/components/visuals/CollegeClassroomVisual.tsx` (copy any
   existing one — they're plain SVG plus a few CSS animations).
2. Register it in `src/components/visuals/registry.ts`:

```ts
'college-classroom': () =>
  import('./CollegeClassroomVisual').then((m) => ({ default: m.CollegeClassroomVisual })),
```

It's code-split automatically. Use the `<Hotspot>` component for clickable
easter eggs, and `useToast().push(message, tag)` for the little popups.

Add a matching thumbnail branch in `src/components/visuals/MiniPreview.tsx` if
you want a bespoke card preview — otherwise the generic one is used.

### Step 4 (optional) — playlists

Add a key to `PLAYLISTS` in `src/music/playlists.ts`:

```ts
college: [
  {
    id: 'college-vibes',
    name: 'College Vibes',
    description: 'Backbench, earphone splitter, one song.',
    mood: 'Nostalgic',
    youtubePlaylistId: '',
  },
],
```

`playlistsFor('college')` returns `[]` for an unknown key rather than
throwing, so this can wait.

---

## Architecture

```
src/
├── main.tsx                  entry
├── App.tsx                   provider stack
├── types/theme.ts            the VibeTheme contract — read this first
├── themes/
│   ├── judaad-house.ts       one file per mode: pure data
│   ├── metro.ts
│   ├── indian-train.ts
│   ├── cab-wala.ts
│   ├── office.ts
│   └── index.ts              the registry + id/alias lookup
├── music/
│   ├── playlists.ts          ★ the only file you edit to change music
│   ├── resolve.ts            playlist ID / URL parsing
│   └── youtube.ts            typed IFrame API loader
├── state/
│   ├── vibe-context.ts       + VibeProvider.tsx   theme, prefs, URL, storage
│   ├── player-context.ts     + PlayerProvider.tsx playback state
│   └── toast-context.ts      + ToastProvider.tsx  interaction feedback
├── hooks/                    storage, media queries, clock, rotator, keys
├── components/
│   ├── AppShell.tsx          layout + keyboard shortcuts
│   ├── screens/              Landing, World
│   ├── theme/                background, transition wipe, cards, picker
│   ├── hero/                 title, quotes, stats, ticker, central visual
│   ├── visuals/              one SVG scene per mode + registry (code-split)
│   ├── effects/              ambient layers, registry-driven
│   ├── player/               music player, playlist chips
│   ├── panels/               settings, shortcuts
│   ├── layout/               top bar, status bar
│   └── ui/                   button, modal, slider, switch, toasts
├── utils/                    storage, url, format, events, cn
└── styles/index.css          theme token bridge + ambient keyframes
```

### How theming actually works

`VibeProvider` writes the active theme's colours and fonts onto `<html>` as
CSS custom properties (`--c-primary`, `--f-heading`, …). `src/styles/index.css`
maps those into Tailwind's theme with `@theme inline`:

```css
@theme inline {
  --color-primary: var(--c-primary);
  --color-surface: var(--c-surface);
  --color-ink:     var(--c-text);
  /* … */
}
```

So `bg-surface`, `text-ink` and `border-line` are real Tailwind utilities that
re-colour the entire UI the instant the theme changes — no per-theme
components, no class swapping, no re-render of the tree to restyle it.

> The base colour token is named `canvas`, not `base`, because `text-base` is
> already Tailwind's font-size utility and a colour of the same name would
> shadow it.

### Two registries, both open for extension

- **Visuals** (`components/visuals/registry.ts`) — maps `hero.visual` → a
  lazily imported scene. Unknown ids fall back to `AbstractVisual`.
- **Effects** (`components/effects/AmbientEffects.tsx`) — maps each key of
  `theme.effects` → an ambient layer. Unknown keys are ignored.

Both mean a theme and its artwork can be added independently, and neither can
break an existing mode.

### State

Three small contexts, no state library:

| Context | Owns |
| --- | --- |
| `VibeProvider` | current theme, selected playlist per theme, preferences, transition, URL sync, localStorage |
| `PlayerProvider` | the YouTube player, play state, progress, volume, errors |
| `ToastProvider` | the little interaction messages |

`PlayerProvider` reads from `VibeProvider`, so the nesting order in `App.tsx`
matters.

---

## Deploying to Netlify

`netlify.toml` is committed and ready:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

It also sets Node 20, an SPA fallback so `?mode=` links survive a hard
refresh, long-lived caching for hashed assets, and a few security headers.

**Via the dashboard:** connect the repo. Netlify reads `netlify.toml`, so
there is nothing to configure.

**Via the CLI:**

```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

No environment variables are required. No secrets exist in this project —
a YouTube playlist ID is public by nature.

---

## Environment variables

**None are required.** The app runs fully configured from source files.

`.env.example` lists optional per-deploy overrides (`VITE_PLAYLIST_*`) for
pointing a staging site at different playlists without changing code. Copy it
to `.env` locally, or set them in Netlify.

> Vite inlines every `VITE_*` variable into the public bundle. Never put a
> secret, private key or service-account credential in one.

---

## Customising further

**Change the quotes** — edit the `quotes` array in the theme file. They rotate
every 6.5 seconds and pause while hovered; the ↻ button steps through them.

**Change the terminal ticker** — edit `ticker`. It feeds both the status strip
and the on-screen screens (the laptop in Judaad House, the monitor in Office).

**Change the stats panel** — edit `stats`. Add `meter: 0…1` to render a bar
instead of a value.

**Add an ambient effect** — write a component in
`components/effects/AmbientEffects.tsx`, add it to `MOTION_EFFECTS` or
`STATIC_EFFECTS`, then add the key to `VibeEffects` in `types/theme.ts`.
Existing themes are unaffected.

**Add an animation** — decorative keyframes live in `src/styles/index.css`
prefixed `vm-`. Keep them to `transform` and `opacity` so they stay on the
compositor, and they'll automatically be disabled by the reduced-motion rule
and paused when the tab is hidden.

**Rename the site** — the wordmark is in `components/layout/TopBar.tsx`; the
default titles are in `index.html` and `VibeProvider`.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Previous / next track |
| `M` | Mute |
| `1`–`9` | Jump to that mode |
| `Ctrl` / `⌘` + `K` | Open the mode picker |
| `?` | Shortcut help |
| `Esc` | Close any open panel |

Per-mode extras: `A` for a metro announcement, `R` to reroute the cab. Scene
hotspots (the chai, the screwdriver, the lamp, the train window, the nav
screen) are clickable and keyboard-focusable.

Shortcuts deliberately yield to focused controls — `Space` presses the button
you've tabbed to, and arrow keys move the volume slider, rather than being
swallowed by the player.

---

## Sharing links

The address bar always reflects where you are:

```
/?mode=metro
/?mode=cab-wala&playlist=cab-rain
```

Opening one skips the landing screen and drops you straight into that world.
The link button in the expanded player copies the current one.

Theme `aliases` mean old or misspelt links keep working — `?mode=jugaad-house`,
`?mode=train` and `?mode=cab` all resolve. Unknown values fall back to the
landing screen instead of erroring.

---

## Notes on YouTube

Playback uses the **official YouTube IFrame Player API**. Nothing is
downloaded, proxied or extracted — the real player is embedded and driven
through its documented API.

The iframe is deliberately **visible**, doing double duty as the artwork tile
in the player bar (it grows into a proper video when you expand the player).
That keeps the integration well within YouTube's terms while still looking
like part of the site rather than a bolted-on embed.

Autoplay policies are respected: nothing plays until you press play. After
that first interaction, switching modes carries playback across.

Failure states are all handled and worded like a human: an invalid ID, a
private or deleted playlist, an un-embeddable track (skipped automatically,
up to three in a row), a network drop, or an empty playlist. One broken
playlist never takes the site down.

---

## Accessibility & performance

- Semantic landmarks, a skip link, and a real heading hierarchy
- Every control is keyboard-reachable with visible focus rings; scene hotspots
  are `role="button"` with labels
- Dialogs trap focus, close on `Esc`, and restore focus on close
- Sliders are native range inputs, so screen readers and touch dragging work
- `aria-live` on the rotating quote and the toast stack
- `prefers-reduced-motion` is honoured at both the CSS and Motion layers, and
  can be overridden in Settings
- Animations pause entirely when the tab is hidden
- Ambient layers use only `transform` and `opacity`
- Each mode's artwork is a separate chunk, preloaded when you hover its card

---

Built as a place to keep open while travelling, working, or doing nothing at
home. Chai optional but recommended.
