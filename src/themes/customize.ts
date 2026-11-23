import type { VibeColors, VibeEffects, VibeTheme } from '@/types/theme';
import { safeCustomImage } from '@/themes/backgrounds';

/* ══════════════════════════════════════════════════════════════════════════
 *  LISTENER CUSTOMISATION
 *
 *  What a visitor changed about the modes, saved in their browser only:
 *  edits to any mode (built-in or their own), the modes they added, and the
 *  order and visibility of all of them.
 *
 *  It stands on the same footing as custom playlists: values a person typed
 *  into the running site, not configuration the repo ships — so a picture URL
 *  here does not break the "no image URLs in source" rule.
 *
 *  Theme files stay the defaults. Nothing here ever mutates them; the provider
 *  rebuilds the list from `THEMES` + this record on every change, so "reset"
 *  is just deleting an entry.
 *
 *  Everything read back from storage or an imported backup goes through
 *  `sanitizeCustomization` first. A hand-edited or hostile value must never
 *  reach CSS variables, an `src`, or state that bricks the app on every load.
 * ══════════════════════════════════════════════════════════════════════════ */

export const COLOR_KEYS = [
  'primary',
  'accent',
  'background',
  'text',
  'secondary',
  'backgroundAlt',
  'surface',
  'muted',
  'border',
  'glow',
] as const satisfies readonly (keyof VibeColors)[];

export const EFFECT_KEYS = [
  'grain',
  'vignette',
  'scanlines',
  'dust',
  'haze',
  'daylight',
] as const satisfies readonly (keyof VibeEffects)[];

/** Text fields and how long each may be. */
export const TEXT_LIMITS = { name: 40, shortName: 18, kicker: 48, description: 140 } as const;
type TextKey = keyof typeof TEXT_LIMITS;

const MAX_QUOTES = 40;
const MAX_QUOTE_LENGTH = 200;
/** An uploaded still is a base64 WebP/JPEG of at most 1600px — ~0.5 MB. */
export const MAX_IMAGE_LENGTH = 1_500_000;

export interface ModeEdit extends Partial<Record<TextKey, string>> {
  quotes?: string[];
  colors?: Partial<VibeColors>;
  effects?: VibeEffects;
  /** URL, site path, or uploaded still. `null` = no picture, show the gradient. */
  image?: string | null;
  hidden?: boolean;
}

/** A mode the listener added: a copy of a built-in one, under its own id. */
export interface AddedMode {
  id: string;
  baseId: string;
}

export interface Customization {
  edits: Record<string, ModeEdit>;
  added: AddedMode[];
  /** Mode ids in the listener's order. Ids missing from it keep default order, after. */
  order: string[];
}

export const EMPTY_CUSTOMIZATION: Customization = { edits: {}, added: [], order: [] };

/** Added ids can never collide with a built-in id or a `VITE_*` variable name. */
const ADDED_ID = /^my-[a-z0-9]{4,16}$/;
const HEX = /^#[0-9a-f]{6}$/i;

export const isAddedMode = (id: string): boolean => ADDED_ID.test(id);

export const newAddedId = (): string =>
  `my-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toLowerCase()}`;

/* ── Building the list ────────────────────────────────────────────────── */

function applyEdit(theme: VibeTheme, edit: ModeEdit | undefined): VibeTheme {
  if (!edit) return theme;

  const colors = { ...theme.colors, ...edit.colors };
  const quotes = edit.quotes?.map((quote) => quote.trim()).filter(Boolean);
  const recoloured = Boolean(edit.colors?.background || edit.colors?.backgroundAlt);
  const name = edit.name?.trim();

  return {
    ...theme,
    // An emptied field means "back to the default", never a blank title.
    name: name || theme.name,
    shortName: edit.shortName?.trim() || theme.shortName,
    description: edit.description?.trim() || theme.description,
    hero: { ...theme.hero, kicker: edit.kicker?.trim() || theme.hero.kicker },
    quotes: quotes?.length ? quotes : theme.quotes,
    colors,
    // The built-in gradients are hand-tuned to the built-in colours. Once the
    // listener picks their own base colours, a plain blend of those is what
    // they expect to see behind a mode with no picture.
    background: recoloured
      ? {
          ...theme.background,
          gradient: `linear-gradient(180deg, ${colors.backgroundAlt} 0%, ${colors.background} 100%)`,
        }
      : theme.background,
    effects: edit.effects ?? theme.effects,
    customImage: edit.image !== undefined ? edit.image : theme.customImage,
    // A hand-written SEO title would still name the old mode after a rename.
    seo: name ? undefined : theme.seo,
  };
}

/**
 * Every mode — built-in and added, edits applied, hidden ones included — in the
 * listener's order. Callers filter `hidden` for anything a visitor picks from.
 */
export function buildThemes(builtIns: readonly VibeTheme[], custom: Customization): VibeTheme[] {
  const byId = new Map(builtIns.map((theme) => [theme.id, theme]));

  const added = custom.added.flatMap(({ id, baseId }) => {
    const base = byId.get(baseId);
    // Keeps the base's icon, fonts, flavour text and music; drops its aliases
    // (old links must keep meaning the original) and SEO copy.
    return base ? [{ ...base, id, baseId, aliases: undefined, seo: undefined }] : [];
  });

  const rank = new Map(custom.order.map((id, index) => [id, index]));
  const last = Number.MAX_SAFE_INTEGER;

  return [...builtIns, ...added]
    .map((theme) => applyEdit(theme, custom.edits[theme.id]))
    .sort((a, b) => (rank.get(a.id) ?? last) - (rank.get(b.id) ?? last));
}

/** Resolves an id or alias against a list, as `findTheme` does for the built-ins. */
export function findIn(
  themes: readonly VibeTheme[],
  id: string | null | undefined,
): VibeTheme | undefined {
  if (!id) return undefined;
  const key = id.trim().toLowerCase();
  return themes.find((theme) => theme.id === key) ?? themes.find((t) => t.aliases?.includes(key));
}

export const isHidden = (custom: Customization, id: string): boolean =>
  custom.edits[id]?.hidden === true;

/* ── Validation (trust boundary) ──────────────────────────────────────── */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clip = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

function sanitizeEdit(raw: unknown): ModeEdit | null {
  if (!isRecord(raw)) return null;
  const edit: ModeEdit = {};

  for (const key of Object.keys(TEXT_LIMITS) as TextKey[]) {
    const value = clip(raw[key], TEXT_LIMITS[key]);
    if (value !== undefined) edit[key] = value;
  }

  if (Array.isArray(raw.quotes)) {
    edit.quotes = raw.quotes
      .filter((quote): quote is string => typeof quote === 'string')
      .slice(0, MAX_QUOTES)
      .map((quote) => quote.slice(0, MAX_QUOTE_LENGTH));
  }

  // Only #rrggbb reaches a CSS variable — anything else could smuggle `url()`
  // or a broken declaration into every rule that reads the token.
  if (isRecord(raw.colors)) {
    const colors: Partial<VibeColors> = {};
    for (const key of COLOR_KEYS) {
      const value = raw.colors[key];
      if (typeof value === 'string' && HEX.test(value)) colors[key] = value.toLowerCase();
    }
    if (Object.keys(colors).length) edit.colors = colors;
  }

  if (isRecord(raw.effects)) {
    const effects: VibeEffects = {};
    for (const key of EFFECT_KEYS) {
      if (typeof raw.effects[key] === 'boolean') effects[key] = raw.effects[key] as boolean;
    }
    edit.effects = effects;
  }

  if (raw.image === null) edit.image = null;
  else if (typeof raw.image === 'string' && raw.image.length <= MAX_IMAGE_LENGTH) {
    const image = safeCustomImage(raw.image);
    if (image) edit.image = image;
  }

  if (raw.hidden === true) edit.hidden = true;
  return edit;
}

/**
 * Turns anything — a stored value, a parsed backup file — into a valid
 * `Customization`, dropping whatever does not check out rather than failing.
 */
export function sanitizeCustomization(raw: unknown, builtInIds: ReadonlySet<string>): Customization {
  if (!isRecord(raw)) return EMPTY_CUSTOMIZATION;

  const added: AddedMode[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(raw.added) ? raw.added.slice(0, 50) : []) {
    if (!isRecord(entry)) continue;
    const { id, baseId } = entry;
    if (typeof id !== 'string' || !ADDED_ID.test(id) || seen.has(id)) continue;
    if (typeof baseId !== 'string' || !builtInIds.has(baseId)) continue;
    seen.add(id);
    added.push({ id, baseId });
  }

  const known = (id: string) => builtInIds.has(id) || seen.has(id);

  const edits: Record<string, ModeEdit> = {};
  if (isRecord(raw.edits)) {
    for (const [id, value] of Object.entries(raw.edits)) {
      if (!known(id)) continue;
      const edit = sanitizeEdit(value);
      if (edit) edits[id] = edit;
    }
  }

  const order = Array.isArray(raw.order)
    ? [...new Set(raw.order.filter((id): id is string => typeof id === 'string' && known(id)))]
    : [];

  return { edits, added, order };
}
