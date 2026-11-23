/* ══════════════════════════════════════════════════════════════════════════
 *  BACKGROUND IMAGE CONFIGURATION
 *
 *  ⚠️  NO IMAGE URLs IN THIS FILE. EVER.
 *
 *  Each mode's background picture comes from `.env`, the same way playlist IDs
 *  do. Nothing here holds a path — this file only works out which variable to
 *  read and checks that what came back is safe to put in an `src`.
 *
 *  ── Where the URL comes from ─────────────────────────────────────────────
 *  The variable name is derived from the theme `id`:
 *
 *      id: 'judaad-house'  →  VITE_IMAGE_JUDAAD_HOUSE
 *      id: 'metro'         →  VITE_IMAGE_METRO
 *
 *  So a new mode needs no wiring at all — add the matching line to `.env`.
 *
 *  ── What the value can be ────────────────────────────────────────────────
 *  Either a file you dropped in `public/`:
 *
 *      VITE_IMAGE_METRO=/backgrounds/metro.avif
 *
 *  or a full URL on any host:
 *
 *      VITE_IMAGE_METRO=https://example.com/metro.png
 *
 *  A mode with nothing set simply shows its colour gradient, which is a
 *  perfectly good background on its own — no broken image, no empty frame.
 * ══════════════════════════════════════════════════════════════════════════ */

import type { VibeTheme } from '@/types/theme';

/**
 * Vite inlines the whole `import.meta.env` object at build time, not just the
 * property accesses it can see, so looking a key up dynamically is safe and
 * lets the variable name be derived from the theme id.
 */
const ENV = import.meta.env as unknown as Record<string, string | undefined>;

/** `'judaad-house'` → `'VITE_IMAGE_JUDAAD_HOUSE'`. */
export function imageVarFor(themeId: string): string {
  return `VITE_IMAGE_${themeId.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;
}

/** `'judaad-house'` → `'VITE_POSTER_JUDAAD_HOUSE'`. */
export function posterVarFor(themeId: string): string {
  return `VITE_POSTER_${themeId.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;
}

/**
 * Only `http(s)` and site-relative paths are allowed through.
 *
 * The value is build-time configuration rather than user input, so this is not
 * the last line of defence — but it goes straight into an `src`, and letting
 * something like a `javascript:` or `data:` value reach that is exactly the
 * kind of thing that is cheap to prevent and unpleasant to discover later.
 *
 * Returns the value to use, or `null` if it is not usable.
 *
 * A bare relative path (`backgrounds/metro.avif`) is accepted and normalised to
 * a rooted one. It can only ever mean a file served from this site, so there is
 * nothing to protect against — and rejecting it was a genuinely bad failure:
 * the mode fell back to its gradient and looked exactly like a mode with no
 * image configured, so a missing slash read as "I haven't set that one up yet"
 * rather than as the typo it was.
 */
function safeImageUrl(value: string): string | null {
  // Protocol-relative (`//host/x.png`) is deliberately not treated as a path.
  if (value.startsWith('/') && !value.startsWith('//')) return value;

  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' ? value : null;
  } catch {
    // Not an absolute URL. A value with no scheme and no leading slash is a
    // path relative to `public/`, which is what dropping a file in there and
    // typing its name naturally produces.
    return /^[\w.-]+(?:\/[\w.-]+)*$/.test(value) ? `/${value}` : null;
  }
}

/**
 * The only `data:` URLs let through: the base64 stills the Customize panel
 * encodes itself from a picture the listener uploads. Raster image types only —
 * never SVG, which can carry script — and never from `.env`, which still goes
 * through `safeImageUrl` alone.
 */
const UPLOADED_IMAGE = /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Checks a background the listener set themselves (Customize panel, or an
 * imported backup — so untrusted). Same rules as `.env` values, plus uploads.
 */
export function safeCustomImage(value: string): string | null {
  const trimmed = value.trim();
  if (UPLOADED_IMAGE.test(trimmed)) return trimmed;
  return trimmed ? safeImageUrl(trimmed) : null;
}

/**
 * Extensions we hand to a `<video>` rather than an `<img>`. Matched against
 * the path only, so a URL with a query string still resolves.
 */
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogv|m4v|mov)$/i;

export interface ThemeBackground {
  url: string;
  kind: 'image' | 'video';
}

function pathOf(value: string): string {
  try {
    return new URL(value, 'https://x.invalid').pathname;
  } catch {
    return value;
  }
}

/** The parts of a theme that decide its background. */
type BackgroundSource = Pick<VibeTheme, 'id' | 'baseId' | 'customImage'>;

/** Whose `.env` variables a mode reads: a listener-added mode borrows its base's. */
const envKeyOf = (theme: BackgroundSource): string => theme.baseId ?? theme.id;

/**
 * The background for a mode — a still or a short looping clip — or `null` when
 * none is configured or the value is not a usable URL.
 *
 * The same `VITE_IMAGE_*` variable takes both, decided by the file extension,
 * so switching a mode from a picture to a video is a one-line edit and needs
 * no second variable to keep in sync.
 *
 * A picture the listener chose (`customImage`) wins over `.env`; `null` there
 * means they removed the picture on purpose, so the gradient shows.
 */
export function backgroundFor(theme: BackgroundSource): ThemeBackground | null {
  if (theme.customImage === null) return null;

  const url = theme.customImage
    ? safeCustomImage(theme.customImage)
    : safeImageUrl(ENV[imageVarFor(envKeyOf(theme))]?.trim() ?? '');
  if (!url) return null;

  return { url, kind: VIDEO_EXTENSIONS.test(pathOf(url)) ? 'video' : 'image' };
}

/**
 * A still for a mode: its poster if one is set, otherwise the background
 * itself when that is already an image.
 *
 * Used where a video would be the wrong thing to load — the mode cards, where
 * eight autoplaying clips would cost far more than the thumbnails are worth.
 * A video-backed mode with no poster simply falls back to its gradient, which
 * is what an unconfigured mode shows too.
 */
export function backgroundStillFor(theme: BackgroundSource): string | null {
  // The `.env` poster belongs to the `.env` background; once the listener has
  // picked their own (or removed it), that poster would show the wrong thing.
  const poster = theme.customImage === undefined ? ENV[posterVarFor(envKeyOf(theme))]?.trim() : '';
  if (poster) {
    const url = safeImageUrl(poster);
    if (url) return url;
  }

  const background = backgroundFor(theme);
  return background?.kind === 'image' ? background.url : null;
}
