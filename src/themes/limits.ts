// Shared by the browser (customize.ts) and the server (server/lib.ts), so
// both refuse the same sizes. No imports: the server bundle must stay small.

/** An uploaded still is a base64 WebP/JPEG of at most 1600px — ~0.5 MB. */
export const MAX_IMAGE_LENGTH = 1_500_000;

/** Room for uploaded pictures: under the ~5 MB browsers give a site, with space left for the rest. */
export const UPLOAD_BUDGET = 3_500_000;
