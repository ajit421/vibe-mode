# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Vibe Mode** — a single-page React-API app that ships on **Preact** (`@preact/preset-vite` aliases `react`/`react-dom` → `preact/compat`; source still imports from `'react'` and type-checks against `@types/react`). Don't add React-only APIs `preact/compat` lacks, or libraries that bundle their own copy of React. You pick a "mode" (a place: metro, train, office, hostel-ish house…) and the whole site becomes that world: colours, typography, background image, ambient motion, quotes, and a YouTube playlist that goes with it. No router, no state library, no UI kit.

## Commands

Requires Node 20+.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | `tsc -b` then `vite build` → `dist/` |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint over `**/*.{ts,tsx}` |
| `npm run preview` | Serve the production build |
| `npm run og` | Regenerate `public/og.png` |
| `npm test` | Vitest, once (`vitest run`) |
| `npm run deploy` | Build, then `wrangler pages deploy` to Cloudflare Pages |
| `npm run preview:cf` | Build, apply `migrations/` to a local D1, serve with Functions on :8788 |
| `npm run db:migrate` | Apply `migrations/` to the live D1 database |
| `npm run env-to-defaults` | One-time: old `.env` → `defaults.seed.sql` (gitignored) for `wrangler d1 execute` |

Verification is `npm run typecheck && npm run lint && npm test`. Tests live next to the code as `*.test.ts`; today they cover the customisation sanitiser, link parsing and the time-of-day default ([customize.test.ts](src/themes/customize.test.ts)), the stored-data sanitisers, and the site-defaults sanitiser and merge order ([defaults.test.ts](src/themes/defaults.test.ts)). `functions/` is linted but not type-checked. Vitest runs through `vite.config.ts` — its `test` block points `lucide-react` at its ESM build, because React itself isn't installed (Preact) and lucide's CommonJS build `require`s it.

On Windows, run `npm test` from PowerShell, cmd or the VS Code terminal, not Git Bash: Git Bash's lowercase `/d/` drive path makes Vitest load itself twice and every test fails with `Cannot read properties of undefined (reading 'config')`.

`npm run dev` has no Pages Functions, so Vite proxies `/api` to the live site (read-only). To exercise `functions/` and a local D1, use `npm run preview:cf`; seed it with `npx wrangler d1 execute vibe-mode --local --file=defaults.seed.sql`.

## Hard invariants

These are enforced by types and comments in the code, and are not stylistic preferences. Violating them will look like a working change and be wrong.

1. **No YouTube playlist/video IDs anywhere in source.** [src/music/playlists.ts](src/music/playlists.ts) describes what each playlist *is*; its `PlaylistDefinition` type is `Omit<VibePlaylist, 'youtubePlaylistId' | 'videoIds'>`, so pasting an ID there is a compile error. IDs come from the D1 `defaults` table only — never a committed seed file (`defaults.seed.sql` is gitignored).
2. **No image URLs or paths in source.** Same pattern in [src/themes/backgrounds.ts](src/themes/backgrounds.ts) — which picture a mode shows comes from D1. The files themselves live in `public/backgrounds/`.
3. **The app is one non-scrolling screen at every viewport.** `html, body { overflow: hidden }`, and [AppShell.tsx](src/components/AppShell.tsx) owns a `h-dvh` flex column that every child fits inside. Content that doesn't fit is *dropped*, not scrolled — see the `vm-hide-short` / `vm-hide-shorter` height-budget utilities in [src/styles/index.css](src/styles/index.css). Keep it visually calm, not dashboard-like.
4. **The player is music-only.** The YouTube iframe must stay in the layout and stay painted (YouTube refuses to play from a `display:none` or zero-sized iframe), but it is deliberately covered by cover art and kept thumbnail-sized so YouTube streams the lowest video rendition and spends bandwidth on audio. See [MusicPlayer.tsx:214-234](src/components/player/MusicPlayer.tsx#L214-L234). Never expose the video.

## Site defaults live in D1, not `.env`

There is no `.env`. What each built-in playlist plays and each mode's background/poster is a row in the `defaults` table of the `vibe-mode` D1 database ([migrations/0001_defaults.sql](migrations/0001_defaults.sql) documents the columns), served by [functions/api/config.ts](functions/api/config.ts) as `/api/config` and laid onto the theme files by `withDefaults` in [src/themes/defaults.ts](src/themes/defaults.ts):

```
('playlist', 'metro-vibes', '<playlist id or link, or video ids>')
('image',    'metro',       '/backgrounds/metro.avif')
('poster',   'metro',       '/backgrounds/metro.avif')   -- for a video background
```

Rows are matched by id at runtime, so adding a playlist or theme needs no wiring — just the row. An edit shows on visitors' next load; nothing is rebuilt.

- First paint never waits on the network: the last answer is cached in localStorage (`vibe-mode.defaults`) and used at once; `index.html` preloads `/api/config`; the service worker never caches `/api/*`.
- Everything from `/api/config` goes through `sanitizeDefaults` (same parsers as a typed link: `normaliseSource`, `safeImageUrl`). Keep any new kind of row behind it.
- `defaultImage` / `defaultPoster` on `VibeTheme` are runtime-only, set by `withDefaults`. A listener-added mode copies its base *after* defaults are applied, so it borrows them for free.

Everything degrades gracefully when a row is missing or the database is down: an unconfigured playlist shows a setup hint (in dev it names the missing row), a mode with no image falls back to its colour gradient, and a failed fetch keeps the cached defaults. Never make a missing row throw.

Precedence for a playlist: listener override (Customize / old Settings → localStorage) > D1 default > nothing. See `resolvePlaylistSource` in [src/music/resolve.ts](src/music/resolve.ts). `BACKGROUNDS.md` at the repo root holds image-generation prompts.

## Architecture

### Themes are data

[src/themes/](src/themes/) — one file per mode exporting a `VibeTheme` (pure data: colours, typography, background gradient, hero copy, quotes, optional stats/hud/ticker/effects/seo). [src/themes/index.ts](src/themes/index.ts) is the registry array.

Adding a mode is **two steps**: create the file, add it to `THEMES`. The mode picker, number-key shortcut, `?mode=` URL resolution, SEO title, playlist wiring and colour scheme are all derived from that array at runtime. Array *order* determines picker order and which number key (1–9) jumps to it. `aliases` let old or misspelt `?mode=` values keep resolving.

Read [src/types/theme.ts](src/types/theme.ts) first — it is the contract, and its doc comments explain what each optional block does.

### Listener customisation layers over the theme files

Visitors have full control from the Customize panel (palette icon in the top bar, lazy-loaded): create blank modes, copy, delete (built-ins go to a restorable bin via `edits[id].deleted`), hide, reorder; edit every text field, icon, heading font, picture, colours, layers and status-readout text; and add / rename / relink / remove any playlist in any mode (built-in playlist edits are per-mode `removedPlaylists` / `playlistNames` / `playlistSources`; the listener's own stay in `customPlaylists` storage). That lives in [src/themes/customize.ts](src/themes/customize.ts): a `Customization` record in localStorage (`vibe-mode.customization`) that `buildThemes(THEMES, customization, uploads)` lays over the theme files. The theme files are never mutated — they are the defaults, and "reset" deletes an entry.

- `VibeProvider` exposes `themes` (visible, listener's order — what pickers, number keys and `?mode=` use) and `allThemes` (hidden included). Resolve ids with `findIn(list, id)`, not the static `findTheme`, or a listener's own mode won't survive a reload.
- `customImage` / `baseId` / `defaultImage` / `defaultPoster` on `VibeTheme` are **runtime-only** — never set them in a theme file. A listener-added mode (`my-xxxxxxxx`) borrows its `baseId`'s default background, poster and playlists.
- Everything from storage or an imported file goes through `sanitizeCustomization` / `sanitizeUploads` (hex-only colours, `safeCustomImage` for pictures, known ids only). Keep any new editable field behind them, and add a case to the test.
- Uploaded pictures live under their **own** key (`vibe-mode.uploads`, by mode id); the mode's `image` is just the marker `UPLOADED`. Don't put stills back in the customisation record — it is rewritten on every keystroke in the panel.
- Visitor data (`customization`, `uploads`, `customPlaylists`, `preferences`, `playlistOverrides`) syncs across open tabs via `useLocalStorage(..., syncAcrossTabs)`. Which mode a tab shows does not.
- "Restore from file" takes a full backup (replaces everything) or a shared single mode (`kind: 'mode'`, always *added* under a new id). The crash screen downloads the same backup before it clears anything.

### Theming works through CSS custom properties, not components

`VibeProvider` writes the active theme's `--c-*` / `--f-*` values onto `<html>`. [src/styles/index.css](src/styles/index.css) maps those into Tailwind v4 via `@theme inline`, so `bg-surface`, `text-ink`, `border-line`, `text-muted` are real utilities that recolour the whole UI the instant the theme changes — no per-theme components, no class swapping, no re-render to restyle.

The base colour token is named `canvas`, **not** `base` — `text-base` is already Tailwind's font-size utility and would be shadowed.

Tailwind v4, CSS-first: there is no `tailwind.config.js`. Design tokens live in the `@theme inline` block.

### State: three contexts, nesting order matters

[App.tsx](src/App.tsx) — `ErrorBoundary > VibeProvider > ToastProvider > PlayerProvider > AppShell`.

| Provider | Owns |
| --- | --- |
| `VibeProvider` | active theme, per-theme selected playlist, preferences, transition wipe, `?mode=`/`?playlist=` URL sync, localStorage |
| `PlayerProvider` | the YouTube IFrame player, play state, progress, volume, error states |
| `ToastProvider` | interaction messages |

`PlayerProvider` reads from `VibeProvider`, so it must stay nested inside it. Each context is split into a `*-context.ts` (context + types + hook) and a `*Provider.tsx` (implementation) — that split exists to keep react-refresh happy.

### Two open registries

- **Effects** — `STATIC_EFFECTS` / `MOTION_EFFECTS` maps in [AmbientEffects.tsx](src/components/effects/AmbientEffects.tsx), keyed off `theme.effects`. Unknown keys are ignored, so a new effect is purely additive (add the component, add the key to `VibeEffects`).
- **Backgrounds** — D1 `image` rows keyed by theme id, as above.

The full-frame sweeping effects (tunnel lights, parallax scenery, traffic smears) and the hand-drawn SVG scenes were **removed** — the background is a photo per mode now. `VibeHero` has no `visual` field, and per-mode keyboard extras (A/R/T) are gone with them.

### Storage

All reads go through [src/utils/storage.ts](src/utils/storage.ts), which guards against localStorage being unavailable *and* shape-checks stored values against the fallback — a hand-edited or stale entry must never flow into state and brick the app on every load with no way out. `useLocalStorage`'s third argument, `reconcile`, runs once against the stored value and is how a `?mode=`/`?playlist=` link beats a returning visitor's saved choice.

## Conventions

- `@/` is aliased to `src/` (in both [vite.config.ts](vite.config.ts) and tsconfig).
- Decorative keyframes live in [src/styles/index.css](src/styles/index.css) prefixed `vm-`, and use **only** `transform` and `opacity` so they stay on the compositor. They are then automatically killed by `html[data-motion='off']` and paused by `html[data-tab-hidden='true']`.
- Motion preference has two sources (OS `prefers-reduced-motion` and the in-app Settings toggle) that merge into one `motionEnabled` flag, applied at both the CSS layer (`data-motion`) and the Motion layer (`<MotionConfig reducedMotion>`).
- Comments in this codebase explain *why*, often at length, and frequently record a decision that was tried and reversed. When changing something with such a comment above it, read it first — it usually names the failure mode you are about to reintroduce. Match that density when adding non-obvious code.
- Failure states are worded like a human, never as error codes. One broken playlist must never take the site down.
- Safe-area insets (`--safe-top` … `--safe-right`) exist because `viewport-fit=cover` is set; any edge-anchored bar has to inset itself back out.

## Deploy

Classic Cloudflare Pages (`vibe-mode.pages.dev`), config in [wrangler.jsonc](wrangler.jsonc) (`pages_build_output_dir`). Cloudflare has folded Pages into Workers: Wrangler now hands *new* `pages` projects to Workers, so this one was created with `--force`. Deploys to it need no flag. There is no `404.html`, so Pages serves `index.html` for unknown paths, which is the SPA fallback that lets `?mode=` survive a hard refresh. Headers (immutable caching for hashed assets, `no-cache` for `/sw.js`, security headers) live in [public/_headers](public/_headers).

Pages ignores `Range` and always answers 200 (checked live), and Safari won't play a `<video>` without 206. So `/backgrounds/*.mp4` runs the Pages Function [functions/backgrounds/[[path]].ts](functions/backgrounds/[[path]].ts), which slices the bytes. The only other Function is `/api/*` (the site defaults: one call per page load, D1 bound as `DB` in [wrangler.jsonc](wrangler.jsonc)). [public/_routes.json](public/_routes.json) keeps it that narrow. Every invocation is a billed request (100k/day free), and pictures must stay free static hits, so don't widen it further.

The site moved here from Netlify. Visitor data is per-origin localStorage, so it never follows a domain change. Visitors carry it over with backup → Restore from file. Pick a custom domain before the next move.

A hand-written service worker ([public/sw.js](public/sw.js)) makes the site installable and repeat visits instant; it is registered in production only. Pages are network-first (a deploy is never hidden behind a cache), `/assets/*` cache-first and capped, other same-site files stale-while-revalidate; cross-origin requests, `/api/*` and range requests are never touched. Bump `VERSION` in it to drop old caches; to retire it, ship one that unregisters itself. Builds need no environment variables: a git-triggered build and `npm run deploy` produce the same bundle, and content lives in D1. A schema change is a new file in `migrations/`, applied with `npm run db:migrate` **before** deploying code that needs it.
