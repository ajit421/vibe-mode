// Shared by the browser (customize.ts) and the server (server/), so
// both refuse the same sizes. No imports: the server bundle must stay small.

/** An uploaded still is a base64 WebP/JPEG of at most 1600px — ~0.5 MB. */
export const MAX_IMAGE_LENGTH = 1_500_000;

/** Text fields of a mode and how long each may be. */
export const TEXT_LIMITS = { name: 40, shortName: 18, kicker: 48, description: 140 } as const;

/** Line lists: how many lines, and how long each. */
export const LINE_LIMITS = {
  quotes: [40, 200],
  stats: [12, 64],
  hud: [8, 64],
  ticker: [20, 120],
} as const;

/**
 * Modes a listener can add (new, copied or from a shared file). Enforced where
 * they are added (VibeProvider) and where they are read back (sanitizeCustomization),
 * so a 51st can't be made and then silently dropped on the next load.
 */
export const MAX_ADDED_MODES = 50;

/** Room for uploaded pictures: under the ~5 MB browsers give a site, with space left for the rest. */
export const UPLOAD_BUDGET = 3_500_000;

/** A sign-in password, checked in the browser (the server only sees it stretched; src/sync/password.ts). */
export const PASSWORD_LENGTH = { min: 10, max: 128 } as const;
/**
 * A sign-in username: lowercase letters, numbers, dashes, underscores. The
 * dash is escaped because browsers compile `pattern` with the `v` flag,
 * where a bare `-` in a class is a syntax error and the check is dropped.
 */
export const USERNAME_PATTERN = '[a-z0-9_\\-]{3,30}';
