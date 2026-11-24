# Vibe Mode

**Where are you right now?**

Eight little worlds, sixteen playlists — and any number of your own. Pick the
place you're actually in and the whole site becomes it: colours, typography,
artwork, ambient motion, small jokes, and the music that belongs there. Every
visitor can then rename, recolour, re-picture, reorder, add or delete any of it.

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
2. [Playlists and pictures live in D1](#playlists-and-pictures-live-in-d1) ← **start here**
3. [Customize — for visitors](#customize--for-visitors)
4. [Control it with an AI assistant (MCP)](#control-it-with-an-ai-assistant-mcp)
5. [Tech stack](#tech-stack)
6. [How to add a new theme](#how-to-add-a-new-theme)
7. [Architecture](#architecture)
8. [Deploying to Cloudflare Pages](#deploying-to-cloudflare-pages)
9. [Customising further](#customising-further)
10. [Keyboard shortcuts](#keyboard-shortcuts)
11. [Sharing links](#sharing-links)
12. [Notes on YouTube](#notes-on-youtube)
13. [Accessibility & performance](#accessibility--performance)

---

## Quick start

Requires **Node 20+**.

```bash
npm install
npm run dev              # http://localhost:5173 — reads playlists from the live site
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only, no build |
| `npm test` | Vitest — the customisation sanitiser and link parsing |
| `npm run og` | Regenerate `public/og.png`, the social preview card |
| `npm run preview:cf` | Build, then run the site *with* its Functions against a local D1 database (:8788) |
| `npm run db:migrate` | Apply `migrations/` to the live D1 database |

The site works before you add any playlists. Every mode still looks and
behaves correctly — in development the player names the row it's waiting for.

---

## Playlists and pictures live in D1

**There are no YouTube IDs and no picture paths anywhere in the source code,
and there is no `.env`.** `src/music/playlists.ts` describes what each playlist
*is* — its name, blurb and mood — and its type physically has no ID field, so
pasting one in there is a compile error rather than a style violation:

```ts
export type PlaylistDefinition = Omit<VibePlaylist, 'youtubePlaylistId' | 'videoIds'>;
```

What each playlist plays, and each mode's background, is a row in the
`defaults` table of the `vibe-mode` D1 database (schema:
`migrations/0001_defaults.sql`). The Function `functions/api/config.ts` serves
it as `/api/config`, and the page lays it over the theme files
(`src/themes/defaults.ts`). Change a row and visitors get it on their next
load — **no rebuild, no redeploy**.

| kind | id | value |
| --- | --- | --- |
| `playlist` | playlist id, e.g. `metro-vibes` | playlist id or link, or comma-separated video ids/links |
| `image` | mode id, e.g. `metro` | `/backgrounds/metro.avif` or a full `https://` URL; `.mp4`/`.webm`/… play as a looping video |
| `poster` | mode id | still for a video-backed mode's card |

### Changing one

In the Cloudflare dashboard: **Storage & databases → D1 → vibe-mode → Console**:

```sql
INSERT OR REPLACE INTO defaults (kind, id, value)
VALUES ('playlist', 'metro-vibes', 'PLb8zHNlPrRVJx9K2mHy0uzZ');
```

Or from a terminal, the same SQL with
`npx wrangler d1 execute vibe-mode --remote --command "…"`.

The playlist ID is the `list=` part of its URL. It must be **Public** or
**Unlisted** — private playlists cannot be embedded, and the player will say so.
No playlist yet? One or more video IDs or links, comma-separated, work too.

### First load and offline

The browser keeps the last answer from `/api/config` in localStorage and
paints with it straight away, then refreshes it. `index.html` preloads
`/api/config`, so a first-ever visit shows colour gradients only for a moment.
If the database can't be reached, the page keeps what it had — nothing breaks.

---

## Customize — for visitors

Visitors don't need the codebase. The **palette icon** in the top bar (or
**C**) opens Customize, where they can:

- **Modes** — create a blank one, copy, delete (built-in modes go to a
  restorable bin), hide from the picker, reorder
- **Words** — name, status line, description, quotes; icon and heading font
- **Playlists** — add as many as they like to any mode, rename, relink, remove
  (built-in ones too), play one straight away
- **Look** — upload a picture or paste a link, colours, atmosphere layers,
  and the status-readout text
- **Cloud save & devices** — changes save themselves, with no sign-up;
  **Link another device** makes a sync link, **Add a passkey** lets them sign
  in on a new device with a fingerprint or face; **Sign out other devices**
  and **Delete my cloud copy** take it all back
- **Backup** — download everything as one file, restore it elsewhere, or
  **Share** a single mode as a file a friend adds with *Restore from file*

Changes are kept in the visitor's browser *and* in D1, under a random key the
browser holds — never visible to other visitors, and only a hash of the key is
stored. See "Cloud save" in `CLAUDE.md` for how it works and its limits.
Everything read back (storage, the cloud or a file) goes through
`sanitizeCustomization` in `src/themes/customize.ts`, which is covered by
`npm test`.

### Turning on the bot check (recommended)

Creating a cloud copy is the one thing anybody can do without a key, so it can
be guarded by Cloudflare Turnstile. In the dashboard: **Turnstile → Add
widget** (hostname `vibe-mode.pages.dev`, mode *Managed*). Then, in
**Workers & Pages → vibe-mode → Settings → Variables and secrets**, add
`TURNSTILE_SITE_KEY` (text) and `TURNSTILE_SECRET` (secret), and redeploy.
Until both are set, the check is simply skipped.

Precedence for a playlist's link, highest first:

```
1. The visitor's own link       (Customize → localStorage)
2. The site's default           (D1 `defaults` table, kind 'playlist')
3. Nothing                      → friendly setup prompt, mode still works
```

---

## Control it with an AI assistant (MCP)

Vibe Mode is also an **MCP server**, so Claude, ChatGPT, Gemini — any app that
takes a remote MCP server — can change it for you in plain words: *"make a
rainy-night mode with a lo-fi playlist"*, *"pause the music"*, *"switch to the
office"*.

**Get your link:** Customize → *Cloud save & your devices* → **Connect an AI
assistant** → Copy. It looks like `https://vibe-mode.pages.dev/mcp/<secret>`
and needs no sign-in, so treat it like a password: anyone with it can change
your modes. **Sign out other devices** revokes it.

**Add it to your AI app** (menu names move around between versions):

| App | Where |
| --- | --- |
| Claude (web / desktop) | Settings → Connectors → *Add custom connector* → paste the link |
| ChatGPT | Settings → Apps & Connectors → turn on *Developer mode* → *Create* → paste the link, authentication *None* |
| Gemini CLI | `~/.gemini/settings.json` → `"mcpServers": { "vibe-mode": { "httpUrl": "<link>" } }` |
| Claude Code | `claude mcp add --transport http vibe-mode <link>` |

**What it can do**

| Tool | Does |
| --- | --- |
| `get_my_vibe` | lists your modes, playlists, pictures and preferences |
| `update_mode` | renames, recolours, changes quotes, picture, status line; hides or shows |
| `add_mode` / `remove_mode` / `restore_mode` | copies a mode, bins or deletes one, brings it back |
| `add_playlist` / `update_playlist` | adds, renames, relinks or removes YouTube playlists |
| `set_preferences` | motion, ambient layers, clock, status readouts, quotes |
| `player_status` / `control_player` | what's playing; play, pause, next, previous, mute, volume, switch mode or playlist |

Changes to modes reach an open tab when you come back to it (or at once, if
the tab is listening). **The player tools need a listening tab:** switch on
*Let AI control this tab* in the same section. A listening tab checks for
commands every 4 seconds — one request each, against Cloudflare's free
100,000 a day — so it's off by default and per tab.

**Owner link — the site's defaults for everyone.** Set a secret
`MCP_ADMIN_TOKEN` (32+ random characters) on the Pages project
(**Settings → Variables and secrets**, type *Secret*), redeploy, and connect
`https://vibe-mode.pages.dev/mcp/<that token>`. It offers
`list_site_defaults`, `set_site_default` and `delete_site_default` — the same
rows as the D1 `defaults` table. Without the variable, there is no owner link.

---

## Tech stack

- **Preact 11** behind the React API (`preact/compat`) + **TypeScript** (strict)
- **Vite 6** — build and dev server; **Vitest** for tests
- **Tailwind CSS v4** — CSS-first config, no `tailwind.config.js`
- **Motion** (`motion/react`, formerly Framer Motion) — transitions
- **Lucide React** — icons
- **YouTube IFrame Player API** — playback
- **Cloudflare D1 + Pages Functions** — the site's default playlists and
  pictures, and every visitor's cloud save (`functions/api/`, `server/`)
- **SimpleWebAuthn** — passkey sign-in (server check; browser half lazy-loaded)
- **localStorage** — preferences and every visitor customisation, kept locally too
- **A small service worker** (`public/sw.js`) — installable app, instant repeat
  visits; production only

No state library, no router, no UI kit. First load is about **70 kB of JS
gzipped**; the Customize panel is its own chunk, fetched on first open.
Backgrounds are AVIF pictures (or a looping video) set per mode in D1.

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
number, responds to `?mode=hostel`, and shows its colour gradient as the
background until you give it a picture.

### Step 3 (optional) — give it a picture

Backgrounds come from D1, like playlists — no paths in source. Drop the file
in `public/backgrounds/`, deploy, then add its row:

```sql
INSERT OR REPLACE INTO defaults (kind, id, value) VALUES
  ('image',  'hostel', '/backgrounds/hostel.avif'),   -- or .mp4 for a looping clip
  ('poster', 'hostel', '/backgrounds/hostel.avif');   -- only needed for a video
```

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

Then add its row, keyed by that id:

```sql
INSERT OR REPLACE INTO defaults (kind, id, value)
VALUES ('playlist', 'hostel-latenight', 'PLyourPlaylistId');
```

No other wiring — rows are matched to playlists and modes by id at runtime. `playlistsFor('hostel')` returns `[]` for an unknown key rather than
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
│   ├── backgrounds.ts        picks and checks each mode's picture/video
│   ├── defaults.ts           the site's playlists + pictures from /api/config (D1)
│   ├── customize.ts          visitor edits laid over the theme files + sanitiser
│   └── index.ts              the registry
├── music/
│   ├── playlists.ts          what each playlist is (never its ID)
│   ├── resolve.ts            playlist ID / URL parsing, source precedence
│   └── youtube.ts            typed IFrame API loader
├── sync/                     cloud save: keys, fingerprints, API calls, Turnstile
├── state/
│   ├── vibe-context.ts       + VibeProvider.tsx   theme, prefs, URL, storage
│   ├── sync-context.ts       + SyncProvider.tsx   cloud save, sync links, passkeys
│   ├── player-context.ts     + PlayerProvider.tsx playback state
│   └── toast-context.ts      + ToastProvider.tsx  interaction feedback
├── hooks/                    storage (tab-synced), media queries, clock, rotator, keys, install
├── components/
│   ├── AppShell.tsx          layout + keyboard shortcuts
│   ├── screens/              Landing, World
│   ├── theme/                background, transition wipe, cards, picker
│   ├── hero/                 quotes, stats, ticker
│   ├── effects/              ambient layers, registry-driven
│   ├── player/               music player, playlist chips, tracklist
│   ├── panels/               settings, shortcuts, customize (lazy)
│   ├── layout/               top bar, status bar
│   └── ui/                   button, modal, slider, switch, toasts
├── utils/                    storage, backup, url, format, cn
└── styles/index.css          theme token bridge + ambient keyframes

functions/                    Pages Functions (Cloudflare)
├── api/config.ts             site defaults from D1
├── api/profile.ts            a visitor's cloud save: load / save / delete
├── api/uploads/[mode].ts     one uploaded picture
├── api/keys.ts               sync links, sign out other devices
├── api/passkeys/             passkey sign-in (options + verify)
└── backgrounds/[[path]].ts   byte ranges for background video (Safari)
server/lib.ts                 auth, limits and Turnstile shared by functions/api
migrations/                   D1 schema — apply with npm run db:migrate
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

### Open for extension

- **Effects** (`components/effects/AmbientEffects.tsx`) — maps each key of
  `theme.effects` → an ambient layer. Unknown keys are ignored.
- **Backgrounds** — a D1 `image` row keyed by theme id, as above.

A theme and its picture can be added independently, and neither can break an
existing mode.

### State

Four small contexts, no state library:

| Context | Owns |
| --- | --- |
| `VibeProvider` | current theme, selected playlist per theme, preferences, visitor customisation, transition, URL sync, localStorage |
| `SyncProvider` | cloud save, sync links, passkeys |
| `PlayerProvider` | the YouTube player, play state, progress, volume, errors, sleep timer |
| `ToastProvider` | the little interaction messages |

`PlayerProvider` and `SyncProvider` read from `VibeProvider`, so the nesting
order in `App.tsx` matters.

---

## Deploying to Cloudflare Pages

The site lives at `vibe-mode.pages.dev`. `wrangler.jsonc` points Pages at
`dist`. `public/_headers` sets long-lived caching for hashed assets, `no-cache`
for the service worker, and a few security headers. With no `404.html`, Pages
serves `index.html` for unknown paths, so `?mode=` links survive a hard refresh.

The build needs no configuration at all — playlists and pictures are read at
runtime from the `vibe-mode` D1 database, bound to the Functions as `DB` in
`wrangler.jsonc`. `public/_routes.json` sends only `/api/*` and
`/backgrounds/*.mp4` to Functions, so pictures stay free static hits.

**From your machine:**

```bash
npx wrangler login   # once
npm run deploy
```

**From git:** connect the repo in the Cloudflare dashboard under
**Workers & Pages → vibe-mode → Settings → Builds**. No build variables are
needed. A schema change in `migrations/` goes out with `npm run db:migrate`.

---

## Customising further

**Change the quotes** — edit the `quotes` array in the theme file. They rotate
every 6.5 seconds and pause while hovered; the ↻ button steps through them.

**Change the terminal ticker** — edit `ticker`. It feeds the status strip.
(Visitors can rewrite quotes, ticker, stats and status-bar text for themselves
in Customize; the theme file is just the default.)

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

**Rename the site** — the default titles are in `index.html` and
`VibeProvider`; the app name is in `public/site.webmanifest`.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Previous / next track |
| `M` | Mute |
| `1`–`9` | Jump to that mode (in the visitor's own order) |
| `Ctrl` / `⌘` + `K` | Open the mode picker |
| `C` | Customize |
| `?` | Shortcut help |
| `Esc` | Close any open panel |

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

The player is **music-only**. The iframe has to stay in the layout and painted
(YouTube won't play from a hidden or zero-sized one), so it sits thumbnail-sized
under the cover art — which also makes YouTube stream its smallest video
rendition and spend the bandwidth on audio. The video is never shown.

Autoplay policies are respected: nothing plays until you press play. After that
first interaction, switching modes carries playback across.

Failure states are all handled and worded like a human: an invalid ID, a private
or deleted playlist, an un-embeddable track (skipped automatically, up to three
in a row — and Next always stays usable), a network drop, or an empty playlist.
One broken playlist never takes the site down.

A **sleep timer** in Settings pauses the music after 15, 30, 60 or 90 minutes.

---

## Accessibility & performance

- Semantic landmarks, a skip link, and a real heading hierarchy
- Every control is keyboard-reachable with visible focus rings
- Dialogs trap focus, close on `Esc`, and restore focus on close
- Sliders are native range inputs, so screen readers and touch dragging work
- `aria-live` on the rotating quote and the toast stack
- `prefers-reduced-motion` is honoured at both the CSS and Motion layers, and
  can be overridden in Settings
- Animations pause entirely when the tab is hidden
- Ambient layers use only `transform` and `opacity`
- Backgrounds are small AVIF files; the visible one is fetched at high priority
- Installable as an app where the browser supports it (offered in Settings)

---

Built as a place to keep open while travelling, working, or doing nothing at
home. Chai optional but recommended.
