import {
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CarFront,
  Coffee,
  Gamepad2,
  GraduationCap,
  Headphones,
  Heart,
  Home,
  Laptop,
  Moon,
  Mountain,
  Music,
  Plane,
  Radio,
  Sparkles,
  Sun,
  TrainFront,
  TramFront,
  TreePalm,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { VibeColors, VibeEffects, VibeHudItem, VibeStat, VibeTheme } from '@/types/theme';
import { safeCustomImage } from '@/themes/backgrounds';
import { normaliseSource, sourceFields } from '@/music/resolve';
import { MAX_IMAGE_LENGTH, UPLOAD_BUDGET } from '@/themes/limits';

/* ══════════════════════════════════════════════════════════════════════════
 *  LISTENER CUSTOMISATION
 *
 *  What a visitor changed about the modes, saved in their browser only:
 *  edits to any mode (built-in or their own), the modes they added, and the
 *  order, visibility and deletion of all of them. Their own playlists live in
 *  `customPlaylists` storage; edits to a mode's *built-in* playlists (rename,
 *  relink, remove) live here, per mode.
 *
 *  It stands on the same footing as custom playlists: values a person typed
 *  into the running site, not configuration the repo ships — so a picture URL
 *  or playlist id here does not break the "nothing configurable in source" rule.
 *
 *  Theme files stay the defaults. Nothing here ever mutates them; the provider
 *  rebuilds the list from `THEMES` + this record on every change, so "reset"
 *  is just deleting an entry and a deleted built-in mode can come back.
 *
 *  Everything read back from storage or an imported backup goes through
 *  `sanitizeCustomization` first. A hand-edited or hostile value must never
 *  reach CSS variables, an `src`, the player, or state that bricks the app on
 *  every load.
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

/** Icons a listener can give a mode. Stored by key — a component can't be saved. */
export const MODE_ICONS = {
  home: Home,
  metro: TrainFront,
  tram: TramFront,
  cab: CarFront,
  car: Car,
  bus: Bus,
  bike: Bike,
  plane: Plane,
  study: GraduationCap,
  work: Briefcase,
  radio: Radio,
  headphones: Headphones,
  music: Music,
  coffee: Coffee,
  night: Moon,
  day: Sun,
  hills: Mountain,
  sea: Waves,
  beach: TreePalm,
  love: Heart,
  sparkle: Sparkles,
  games: Gamepad2,
  reading: BookOpen,
  laptop: Laptop,
} satisfies Record<string, LucideIcon>;
export type IconKey = keyof typeof MODE_ICONS;

/** Heading fonts on offer — only families `index.html` already loads, plus system stacks. */
export const HEADING_FONTS = {
  grotesk: { label: 'Space Grotesk', stack: '"Space Grotesk", "Segoe UI", system-ui, sans-serif' },
  inter: { label: 'Inter', stack: 'Inter, "Segoe UI", system-ui, sans-serif' },
  mono: { label: 'IBM Plex Mono', stack: '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace' },
  serif: { label: 'Serif', stack: 'Georgia, "Times New Roman", serif' },
  system: { label: 'System', stack: 'system-ui, "Segoe UI", Roboto, sans-serif' },
} as const;
export type FontKey = keyof typeof HEADING_FONTS;

/** Text fields and how long each may be. */
export const TEXT_LIMITS = { name: 40, shortName: 18, kicker: 48, description: 140 } as const;
type TextKey = keyof typeof TEXT_LIMITS;

/** Line lists: how many lines, and how long each. */
const LINE_LIMITS = {
  quotes: [40, 200],
  stats: [12, 64],
  hud: [8, 64],
  ticker: [20, 120],
} as const;
type LineKey = keyof typeof LINE_LIMITS;

export { MAX_IMAGE_LENGTH, UPLOAD_BUDGET };

/**
 * `image` value meaning "the picture the listener uploaded for this mode".
 * The still itself lives under its own storage key (`uploads`), not in here:
 * this record is rewritten on every keystroke in the Customize panel, and
 * carrying half a megabyte of base64 per picture through each of those writes
 * made typing lag. Older saves with the still inline here still work.
 */
export const UPLOADED = 'upload';

/** Mode id → uploaded still (a `data:image/…` URL). */
export type Uploads = Record<string, string>;

/**
 * Whether `still` can be saved for mode `id` beside the other uploads. A write
 * over the browser's quota is dropped silently, which would lose the picture
 * on the next reload while the page still shows it.
 */
export const fitsUploadBudget = (uploads: Uploads, id: string, still: string): boolean =>
  Object.entries(uploads).reduce((total, [key, value]) => total + (key === id ? 0 : value.length), 0) +
    still.length <=
  UPLOAD_BUDGET;

/**
 * The uploaded picture a new mode (a copy, or one added from a shared file)
 * brings along. The still lives apart from the edit, so it has to be carried
 * over explicitly — and only when it fits; otherwise the edit falls back to
 * the default picture instead of pointing at an upload that isn't there.
 */
export function carryUpload(
  edit: ModeEdit,
  still: string | undefined,
  uploads: Uploads,
  id: string,
): { edit: ModeEdit; still?: string } {
  if (edit.image !== UPLOADED) return { edit };
  return still && fitsUploadBudget(uploads, id, still)
    ? { edit, still }
    : { edit: { ...edit, image: undefined } };
}

export interface ModeEdit extends Partial<Record<TextKey, string>>, Partial<Record<LineKey, string[]>> {
  // `quotes` and `ticker` are lines as typed. `stats` and `hud` are
  // "Label: value" lines, parsed when applied — stored raw so a half-typed
  // line doesn't vanish from under the cursor.
  colors?: Partial<VibeColors>;
  effects?: VibeEffects;
  icon?: IconKey;
  headingFont?: FontKey;
  /** URL, site path, `UPLOADED`, or (older saves) an inline still. `null` = no picture. */
  image?: string | null;
  hidden?: boolean;
  /** Built-in modes only — added ones are removed outright. Restorable. */
  deleted?: boolean;
  /** Built-in playlists the listener removed from this mode. */
  removedPlaylists?: string[];
  /** Built-in playlist id → the listener's name for it, in this mode. */
  playlistNames?: Record<string, string>;
  /** Built-in playlist id → a normalised source that replaces the site's default one, in this mode. */
  playlistSources?: Record<string, string>;
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

/** Added ids can never collide with a built-in id, so no `defaults` row can fill one in. */
const ADDED_ID = /^my-[a-z0-9]{4,16}$/;
const SAFE_ID = /^[a-z0-9-]{1,60}$/;
const HEX = /^#[0-9a-f]{6}$/i;

export const isAddedMode = (id: string): boolean => ADDED_ID.test(id);

export const newAddedId = (): string =>
  `my-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toLowerCase()}`;

/* ── Building the list ────────────────────────────────────────────────── */

/** "Label: value" lines → pairs. A line with no colon (or no label) is skipped. */
function parsePairs(lines: string[]): VibeHudItem[] {
  return lines.flatMap((line) => {
    const at = line.indexOf(':');
    const label = at < 0 ? '' : line.slice(0, at).trim();
    return label ? [{ label, value: line.slice(at + 1).trim() }] : [];
  });
}

/** Pairs → the lines the editor shows. */
export const pairsToLines = (pairs: readonly VibeHudItem[] | undefined): string =>
  (pairs ?? []).map((pair) => `${pair.label}: ${pair.value}`).join('\n');

function applyEdit(theme: VibeTheme, edit: ModeEdit | undefined, upload?: string): VibeTheme {
  if (!edit) return theme;

  const colors = { ...theme.colors, ...edit.colors };
  const recoloured = Boolean(edit.colors?.background || edit.colors?.backgroundAlt);
  const name = edit.name?.trim();
  const clean = (lines: string[]) => lines.map((line) => line.trim()).filter(Boolean);

  const removed = new Set(edit.removedPlaylists ?? []);
  const playlists = theme.playlists
    .filter((playlist) => !removed.has(playlist.id))
    .map((playlist) => {
      const rename = edit.playlistNames?.[playlist.id]?.trim();
      const source = edit.playlistSources?.[playlist.id];
      return {
        ...playlist,
        ...(rename ? { name: rename } : {}),
        ...(source ? sourceFields(source) : {}),
      };
    });

  // An edited stat keeps its meter bar when its label still matches one the
  // mode shipped with; there's no sensible way to type a meter into a line.
  const stats: VibeStat[] | undefined = edit.stats
    ? parsePairs(edit.stats).map((pair) => ({
        ...pair,
        meter: theme.stats?.find((stat) => stat.label.toLowerCase() === pair.label.toLowerCase())
          ?.meter,
      }))
    : theme.stats;

  return {
    ...theme,
    // Only the name falls back when emptied — every screen titles itself with
    // it. Everything else a listener empties stays empty: deleting is allowed.
    name: name || theme.name,
    shortName: edit.shortName?.trim() || theme.shortName,
    description: edit.description ?? theme.description,
    hero: { ...theme.hero, kicker: edit.kicker ?? theme.hero.kicker },
    icon: (edit.icon && MODE_ICONS[edit.icon]) || theme.icon,
    typography: edit.headingFont
      ? { ...theme.typography, heading: HEADING_FONTS[edit.headingFont].stack }
      : theme.typography,
    quotes: edit.quotes ? clean(edit.quotes) : theme.quotes,
    ticker: edit.ticker ? clean(edit.ticker) : theme.ticker,
    hud: edit.hud ? parsePairs(edit.hud) : theme.hud,
    stats,
    playlists,
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
    // An upload marker with no upload behind it (removed in another tab, say)
    // falls back to the default picture rather than to a blank.
    customImage:
      edit.image === UPLOADED ? upload : edit.image !== undefined ? edit.image : theme.customImage,
    // A hand-written SEO title would still name the old mode after a rename.
    seo: name ? undefined : theme.seo,
  };
}

/**
 * Every mode — built-in and added, edits applied, hidden and deleted ones
 * included — in the listener's order. The provider splits it into what can be
 * picked, what can be edited, and what is in the bin.
 */
export function buildThemes(
  builtIns: readonly VibeTheme[],
  custom: Customization,
  uploads: Uploads = {},
): VibeTheme[] {
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
    .map((theme) => applyEdit(theme, custom.edits[theme.id], uploads[theme.id]))
    .sort((a, b) => (rank.get(a.id) ?? last) - (rank.get(b.id) ?? last));
}

/** Resolves an id or alias against a list, by id or alias. */
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

export const isDeleted = (custom: Customization, id: string): boolean =>
  custom.edits[id]?.deleted === true;

/* ── Validation (trust boundary) ──────────────────────────────────────── */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clip = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

const lines = (value: unknown, [count, length]: readonly [number, number]): string[] | undefined =>
  Array.isArray(value)
    ? value
        .filter((line): line is string => typeof line === 'string')
        .slice(0, count)
        .map((line) => line.slice(0, length))
    : undefined;

/** A record of safe ids → values that `check` accepts (and may normalise). */
function idRecord(raw: unknown, check: (value: unknown) => string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!isRecord(raw)) return result;
  for (const [id, value] of Object.entries(raw).slice(0, 50)) {
    const checked = SAFE_ID.test(id) ? check(value) : null;
    if (checked) result[id] = checked;
  }
  return result;
}

export function sanitizeEdit(raw: unknown): ModeEdit | null {
  if (!isRecord(raw)) return null;
  const edit: ModeEdit = {};

  for (const key of Object.keys(TEXT_LIMITS) as TextKey[]) {
    const value = clip(raw[key], TEXT_LIMITS[key]);
    if (value !== undefined) edit[key] = value;
  }

  for (const key of Object.keys(LINE_LIMITS) as LineKey[]) {
    const value = lines(raw[key], LINE_LIMITS[key]);
    if (value) edit[key] = value;
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

  if (typeof raw.icon === 'string' && Object.prototype.hasOwnProperty.call(MODE_ICONS, raw.icon)) {
    edit.icon = raw.icon as IconKey;
  }
  if (typeof raw.headingFont === 'string' && Object.prototype.hasOwnProperty.call(HEADING_FONTS, raw.headingFont)) {
    edit.headingFont = raw.headingFont as FontKey;
  }

  if (raw.image === null || raw.image === UPLOADED) edit.image = raw.image;
  else if (typeof raw.image === 'string' && raw.image.length <= MAX_IMAGE_LENGTH) {
    const image = safeCustomImage(raw.image);
    if (image) edit.image = image;
  }

  if (raw.hidden === true) edit.hidden = true;
  if (raw.deleted === true) edit.deleted = true;

  if (Array.isArray(raw.removedPlaylists)) {
    edit.removedPlaylists = raw.removedPlaylists
      .filter((id): id is string => typeof id === 'string' && SAFE_ID.test(id))
      .slice(0, 50);
  }
  const names = idRecord(raw.playlistNames, (value) => clip(value, 60) ?? null);
  if (Object.keys(names).length) edit.playlistNames = names;
  // Same parser the editor uses, so an imported "source" is exactly as safe
  // as a typed one: a playlist id or a list of video ids, nothing else.
  const sources = idRecord(raw.playlistSources, (value) =>
    typeof value === 'string' ? normaliseSource(value) : null,
  );
  if (Object.keys(sources).length) edit.playlistSources = sources;

  return edit;
}

/** Uploaded stills: safe ids → raster `data:image/…` URLs only, size-capped. */
export function sanitizeUploads(raw: unknown): Uploads {
  return idRecord(raw, (value) =>
    typeof value === 'string' && value.startsWith('data:') && value.length <= MAX_IMAGE_LENGTH
      ? safeCustomImage(value)
      : null,
  );
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
