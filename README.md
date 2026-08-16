# Vibe Mode

**Where are you right now?**

Eight little worlds, sixteen playlists. Pick the place you're actually in and
the whole site becomes it: colours, typography, artwork, ambient motion, small
jokes, and the music that belongs there.

It's less a music website and more a digital memory machine.

| Mode | What it is |
| --- | --- |
| 🏠 **Judaad House** | Three engineers, one rented house, infinite jugaad |
| 🚇 **Metro** | Tunnel lights, LED board, eleven minutes to yourself |
| 🚂 **Indian Train** | Window seat, fields going by, chai every forty minutes |
| 🚕 **Cab Wala** | Back seat, wet glass, the city smearing past at 1am |
| 💼 **Office** | Second monitor, third coffee, one tab that's actually work |
| 📻 **Radio Wala** | Dial ghumao, purane gaane, thoda sa static |
| 🚙 **Gadi Wala** | Koi bhi gadi, full volume, sirf famous gaane |
| 🎓 **College Wala** | Last bench, attendance 61%, one earphone each |

---

## Contents

1. [Quick start](#quick-start)
2. [Playlists live in `.env`](#playlists-live-in-env) ← **start here**
3. [Playing your own playlist](#playing-your-own-playlist)
4. [Tech stack](#tech-stack)
5. [How to add a new theme](#how-to-add-a-new-theme)
6. [Architecture](#architecture)
7. [Deploying to Netlify](#deploying-to-netlify)
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
cp .env.example .env     # then fill in your playlists — see below
npm run dev              # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only, no build |
| `npm run og` | Regenerate `public/og.png`, the social preview card |

The site works before you add any playlists. Every mode still looks and
behaves correctly — the player just names the variable it's waiting for.

---

## Playlists live in `.env`

**There are no YouTube IDs anywhere in the source code, and there is no way to
add one.** `src/music/playlists.ts` describes what each playlist *is* — its
name, blurb and mood — and its type physically has no ID field, so pasting one
in there is a compile error rather than a style violation:

```ts
export type PlaylistDefinition = Omit<VibePlaylist, 'youtubePlaylistId' | 'videoIds'>;
```

Every ID comes from `.env`.

### 1. Get the ID

Open your playlist on YouTube and look at the URL:

```
https://www.youtube.com/playlist?list=PLb8zHNlPrRVJx9K2mHy0uzZ
                                      └──────── this bit ────────┘
```

It usually starts with `PL` (a normal playlist), `OLAK5uy_` (an album) or `RD`
(a radio mix).

> The playlist must be **Public** or **Unlisted**. Private playlists cannot be
> embedded, and the player will say so.

### 2. Put it in `.env`

```bash
VITE_PLAYLIST_METRO_VIBES=PLb8zHNlPrRVJx9K2mHy0uzZ
```

Restart `npm run dev` — Vite only reads `.env` on boot. That's the whole job.

### Which variable is which?

The name is derived from the playlist `id`, so you never have to look it up:

```
id: 'metro-vibes'   →   VITE_PLAYLIST_METRO_VIBES
id: 'gadi-hits'     →   VITE_PLAYLIST_GADI_HITS
```

And if you forget, the app tells you: an unconfigured mode prints the exact
variable name in the player bar and again in Settings.

`.env.example` lists all sixteen, grouped by mode.

### No playlist yet? Use individual videos

A comma-separated value is treated as a hand-picked list of video IDs (the
`v=` part of a watch URL):

```bash
VITE_PLAYLIST_METRO_VIBES=dQw4w9WgXcQ,jNQXAC9IVRw,9bZkp7q19f0
```

### Why `.env` rather than a config file?

- One place to look, and it's the place already excluded from git
- Different playlists per deploy — staging and production from one codebase
- Nobody's personal playlists end up in a commit or a pull request

> Vite inlines every `VITE_*` variable into the public JS bundle. That's fine
> for playlist IDs, which are public by nature — but never put a secret, key
> or credential in there.

---

## Playing your own playlist

Listeners don't need the codebase. In the running site:

**Settings (⚙ in the top bar) → Play your own playlist → paste a link → Apply.**

Any YouTube playlist link or bare ID works. It applies to whichever playlist is
selected, takes precedence over the `.env` default, and is saved in that
person's browser only — it never touches the deploy or anyone else's session.
A **Use the default** button appears while an override is active, and clearing
the field falls back to `.env`.

Precedence, highest first:

```
1. The listener's own playlist   (Settings → localStorage)
2. .env                          (VITE_PLAYLIST_*)
3. Nothing                       → friendly setup prompt, mode still works
```

---

## Tech stack

- **React 18** + **TypeScript** (strict)
- **Vite 6** — build and dev server
- **Tailwind CSS v4** — CSS-first config, no `tailwind.config.js`
- **Motion** (`motion/react`, formerly Framer Motion) — transitions
- **Lucide React** — icons
- **YouTube IFrame Player API** — playback
- **localStorage** — preferences

No state library, no router, no UI kit. First load is about **117 kB of JS
gzipped**, and each mode's artwork is a separate ~3 kB chunk fetched only when
you visit that world.

---

## How to add a new theme

Adding a mode is **one new file and one line**. The mode picker, keyboard
shortcut, `?mode=` URL, SEO title, playlist wiring and colour scheme all follow
automatically.

### Step 1 — create `src/themes/hostel.ts`

```ts
import { BedDouble } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { playlistsFor } from '@/music/playlists';

export const hostel: VibeTheme = {
  id: 'hostel',
  name: 'Hostel Wala',
  shortName: 'Hostel',
  description: 'Mess ka khana, 2am maggi, roommate ka alarm.',
  emoji: '🛏️',
  icon: BedDouble,
  aliases: ['pg'],               // optional: extra ?mode= values

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
    kicker: 'ROOM 214 · LIGHTS OUT 11PM',
    title: 'HOSTEL WALA',
    subtitle: 'Mess band ho gaya. Maggi hai.',
    visual: 'hostel-room',       // see step 3
  },

  playlists: playlistsFor('hostel'),

  quotes: ['Maggi bana?', 'Warden aa raha hai.', 'Kal se gym pakka.'],

  // Everything below is optional — omit any of it and the UI adapts.
  stats: [
    { label: 'ROOM', value: '214' },
    { label: 'MAGGI STOCK', value: 'Two packets', meter: 0.3 },
  ],
  hud: [{ label: 'WARDEN', value: 'Sleeping' }],
  ticker: ['> Lights out tha, par kisne suna'],
  effects: { grain: true, vignette: true, dust: true },
  seo: { title: 'Hostel Wala — 2AM Maggi.', description: 'Room 214, lights out, volume low.' },
};
```

### Step 2 — register it in `src/themes/index.ts`

```ts
import { hostel } from './hostel';

export const THEMES: readonly VibeTheme[] = [
  judaadHouse, metro, indianTrain, cabWala, office, radioWala, gadiWala, college,
  hostel,                                                                    // ← added
];
```

**The theme is now live.** It appears in the picker, gets the next keyboard
number, responds to `?mode=hostel`, and shows a themed abstract visual built
from its own palette.

### Step 3 (optional) — give it artwork

Unknown `hero.visual` ids fall back to `AbstractVisual`, so this is genuinely
optional. To draw a real scene:

1. Create `src/components/visuals/HostelRoomVisual.tsx` (copy any existing one
   — they're plain SVG plus a few CSS animations).
2. Register it in `src/components/visuals/registry.ts`:

```ts
'hostel-room': () =>
  import('./HostelRoomVisual').then((m) => ({ default: m.HostelRoomVisual })),
```

It's code-split automatically. Use `<Hotspot>` for clickable easter eggs and
`useToast().push(message, tag)` for the popups. Add a branch in
`MiniPreview.tsx` for a bespoke card thumbnail, or leave it for the generic one.

### Step 4 — playlists

Describe them in `src/music/playlists.ts` (no IDs — the type forbids it):

```ts
hostel: [
  {
    id: 'hostel-latenight',
    name: '2AM Maggi',
    description: 'Everyone is awake. Nobody is studying.',
    mood: 'Late night',
  },
],
```

Then add the derived variable to `.env` and `.env.example`:

```bash
VITE_PLAYLIST_HOSTEL_LATENIGHT=PLyourPlaylistId
```

No other wiring — the variable name is computed from the playlist id at
runtime. `playlistsFor('hostel')` returns `[]` for an unknown key rather than
throwing, so the mode works even before you do this.

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
│   ├── radio-wala.ts
│   ├── gadi-wala.ts
│   ├── college.ts
│   └── index.ts              the registry + id/alias lookup
├── music/
│   ├── playlists.ts          what each playlist is (never its ID)
│   ├── resolve.ts            playlist ID / URL parsing, source precedence
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

`VibeProvider` writes the active theme's colours and fonts onto `<html>` as CSS
custom properties (`--c-primary`, `--f-heading`, …). `src/styles/index.css`
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
recolour the entire UI the instant the theme changes — no per-theme components,
no class swapping, no re-render of the tree to restyle it.

> The base colour token is named `canvas`, not `base`, because `text-base` is
> already Tailwind's font-size utility and a colour of the same name would
> shadow it.

### How the env lookup works

Vite inlines the *whole* `import.meta.env` object at build time, not just the
property accesses it can statically see. That means a dynamic lookup is safe,
which is what lets the variable name be derived from the playlist id instead of
maintained in a hand-written map:

```ts
const ENV = import.meta.env as unknown as Record<string, string | undefined>;
export const envVarFor = (id: string) =>
  `VITE_PLAYLIST_${id.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;
```

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

It also sets Node 20, an SPA fallback so `?mode=` links survive a hard refresh,
long-lived caching for hashed assets, and a few security headers.

**Connect the repo** — Netlify reads `netlify.toml`, so there's nothing else to
configure.

**Then add your playlists.** `.env` is gitignored, so it does not travel with
the repo. Copy the same variables into
**Site configuration → Environment variables**, then redeploy. Without them the
site still builds and works; every mode just shows the setup prompt.

Via the CLI:

```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

---

## Customising further

**Change the quotes** — edit the `quotes` array in the theme file. They rotate
every 6.5 seconds and pause while hovered; the ↻ button steps through them.

**Change the terminal ticker** — edit `ticker`. It feeds the status strip and
the in-scene screens (the laptop in Judaad House, the monitor in Office, the
blackboard in College).

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
| `1`–`8` | Jump to that mode |
| `Ctrl` / `⌘` + `K` | Open the mode picker |
| `?` | Shortcut help |
| `Esc` | Close any open panel |

Per-mode extras: `A` for a metro announcement, `R` to reroute the cab, `T` to
tune the radio. Scene hotspots are clickable and keyboard-focusable — the chai,
the screwdriver and the lamp in Judaad House; the train window; the cab's nav
screen; the radio dial and its three knobs; the car stereo, its volume knob and
the door speaker; the blackboard and the shared earphones in College.

Shortcuts deliberately yield to focused controls — `Space` presses the button
you've tabbed to, and arrow keys move the volume slider, rather than being
swallowed by the player.

---

## Sharing links

The address bar always reflects where you are:

```
/?mode=metro
/?mode=cab-wala&playlist=cab-rain
/?mode=radio-wala
```

Opening one skips the landing screen and drops you straight into that world.
The link button in the expanded player copies the current one.

Theme `aliases` mean short or misspelt links keep working — `?mode=jugaad-house`,
`?mode=train`, `?mode=fm`, `?mode=clg` and `?mode=gadi` all resolve. Unknown
values fall back to the landing screen instead of erroring.

---

## Notes on YouTube

Playback uses the **official YouTube IFrame Player API**. Nothing is
downloaded, proxied or extracted — the real player is embedded and driven
through its documented API.

The iframe is deliberately **visible**, doing double duty as the artwork tile in
the player bar (it grows into a proper video when you expand the player). That
keeps the integration well within YouTube's terms while still looking like part
of the site rather than a bolted-on embed.

Autoplay policies are respected: nothing plays until you press play. After that
first interaction, switching modes carries playback across.

Failure states are all handled and worded like a human: an invalid ID, a private
or deleted playlist, an un-embeddable track (skipped automatically, up to three
in a row), a network drop, or an empty playlist. One broken playlist never takes
the site down.

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
