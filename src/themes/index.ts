import type { VibeTheme } from '@/types/theme';
import { judaadHouse } from './judaad-house';
import { metro } from './metro';
import { indianTrain } from './indian-train';
import { cabWala } from './cab-wala';
import { office } from './office';

/* ══════════════════════════════════════════════════════════════════════════
 *  THEME REGISTRY
 *
 *  Adding a mode is a two-step job:
 *    1. Create `src/themes/<your-mode>.ts` exporting a `VibeTheme`.
 *    2. Import it and drop it in the array below.
 *
 *  Everything else — the mode picker, keyboard shortcut, ?mode= URL, SEO
 *  title, playlist wiring, colours — is derived from this array at runtime.
 *  Order matters: it is the order shown in the picker and the order the
 *  number-key shortcuts (1…9) follow.
 * ══════════════════════════════════════════════════════════════════════════ */
export const THEMES: readonly VibeTheme[] = [judaadHouse, metro, indianTrain, cabWala, office];

export const DEFAULT_THEME_ID = judaadHouse.id;

const BY_ID = new Map<string, VibeTheme>();
for (const theme of THEMES) {
  BY_ID.set(theme.id, theme);
  for (const alias of theme.aliases ?? []) {
    if (!BY_ID.has(alias)) BY_ID.set(alias, theme);
  }
}

/** Resolves an id or alias to a theme. Returns `undefined` if nothing matches. */
export function findTheme(id: string | null | undefined): VibeTheme | undefined {
  if (!id) return undefined;
  return BY_ID.get(id.trim().toLowerCase());
}

/** Like `findTheme`, but always returns something usable. */
export function getTheme(id: string | null | undefined): VibeTheme {
  return findTheme(id) ?? BY_ID.get(DEFAULT_THEME_ID) ?? THEMES[0];
}

export function isKnownTheme(id: string | null | undefined): boolean {
  return findTheme(id) !== undefined;
}
