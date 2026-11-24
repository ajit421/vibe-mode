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

/** Room for uploaded pictures: under the ~5 MB browsers give a site, with space left for the rest. */
export const UPLOAD_BUDGET = 3_500_000;
