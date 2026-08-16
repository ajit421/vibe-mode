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
 *      VITE_IMAGE_METRO=/backgrounds/metro.png
 *
 *  or a full URL on any host:
 *
 *      VITE_IMAGE_METRO=https://example.com/metro.png
 *
 *  A mode with nothing set simply shows its colour gradient, which is a
 *  perfectly good background on its own — no broken image, no empty frame.
 * ══════════════════════════════════════════════════════════════════════════ */

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

/**
 * Only `http(s)` and site-relative paths are allowed through.
 *
 * The value is build-time configuration rather than user input, so this is not
 * the last line of defence — but it goes straight into an `src`, and letting
 * something like a `javascript:` or `data:` value reach that is exactly the
 * kind of thing that is cheap to prevent and unpleasant to discover later.
 */
function isSafeImageUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The background image for a mode, or `null` when none is configured or the
 * configured value is not a usable URL.
 */
export function backgroundImageFor(themeId: string): string | null {
  const value = ENV[imageVarFor(themeId)]?.trim();
  if (!value) return null;
  return isSafeImageUrl(value) ? value : null;
}
