/**
 * Vite inlines the whole `import.meta.env` object at build time, not just the
 * property accesses it can see, so looking a key up dynamically is safe and
 * lets a variable name be derived from a theme or playlist id.
 */
export const ENV = import.meta.env as unknown as Record<string, string | undefined>;

/** `('VITE_IMAGE', 'judaad-house')` → `'VITE_IMAGE_JUDAAD_HOUSE'`. One rule for every derived name. */
export function envName(prefix: string, id: string): string {
  return `${prefix}_${id.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;
}
