import { PLAYLISTS } from '../src/music/playlists';
import { normaliseSource } from '../src/music/resolve';
import { safeImageUrl } from '../src/themes/backgrounds';
import { LINE_LIMITS, TEXT_LIMITS } from '../src/themes/limits';

/*
 * A visitor's saved data (`profiles.data`, the backup shape minus pictures),
 * edited the way the Customize panel edits it — for the AI tools in
 * server/mcp.ts. Pure functions: they take the record, change it in place,
 * and throw `ToolError` with a sentence a person can act on.
 *
 * The browser still runs everything it loads through `sanitizeCustomization`,
 * so a mistake here can never reach the page; these checks are about telling
 * the AI what went wrong instead of having the change silently dropped.
 */

export class ToolError extends Error {}

/** Built-in mode ids, from the playlist catalogue (which has no UI imports). */
export const BUILT_IN_MODES: readonly string[] = Object.keys(PLAYLISTS);

export const COLOR_KEYS = [
  'primary', 'accent', 'background', 'text', 'secondary',
  'backgroundAlt', 'surface', 'muted', 'border', 'glow',
] as const;
export const PREFERENCE_KEYS = ['motion', 'ambient', 'clock', 'hud', 'quotes'] as const;

const HEX = /^#[0-9a-f]{6}$/i;
const ADDED_ID = /^my-[a-z0-9]{4,16}$/;

type Edit = Record<string, unknown> & {
  hidden?: boolean;
  deleted?: boolean;
  removedPlaylists?: string[];
  playlistNames?: Record<string, string>;
  playlistSources?: Record<string, string>;
  colors?: Record<string, string>;
};
interface CustomPlaylist {
  id: string;
  name: string;
  source: string;
}
export interface VibeData {
  customization: { edits: Record<string, Edit>; added: { id: string; baseId: string }[]; order: string[] };
  preferences: Record<string, boolean>;
  customPlaylists: Record<string, CustomPlaylist[]>;
  playlistOverrides: Record<string, string>;
  [field: string]: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Any stored record (or none) as a complete `VibeData`. */
export function asVibeData(raw: unknown): VibeData {
  const data = isRecord(raw) ? raw : {};
  const custom = isRecord(data.customization) ? data.customization : {};
  return {
    ...data,
    app: 'vibe-mode',
    version: 1,
    customization: {
      edits: isRecord(custom.edits) ? (custom.edits as VibeData['customization']['edits']) : {},
      added: Array.isArray(custom.added) ? (custom.added as VibeData['customization']['added']) : [],
      order: Array.isArray(custom.order) ? (custom.order as string[]) : [],
    },
    preferences: isRecord(data.preferences) ? (data.preferences as VibeData['preferences']) : {},
    customPlaylists: isRecord(data.customPlaylists) ? (data.customPlaylists as VibeData['customPlaylists']) : {},
    playlistOverrides: isRecord(data.playlistOverrides) ? (data.playlistOverrides as VibeData['playlistOverrides']) : {},
  };
}

const randomId = (length: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => '0123456789abcdefghijklmnopqrstuvwxyz'[byte % 36]).join('');

const allModes = (data: VibeData) => [...BUILT_IN_MODES, ...data.customization.added.map((mode) => mode.id)];
const baseOf = (data: VibeData, id: string) =>
  BUILT_IN_MODES.includes(id) ? id : data.customization.added.find((mode) => mode.id === id)?.baseId;

function requireMode(data: VibeData, id: string): string {
  if (!allModes(data).includes(id)) {
    throw new ToolError(`There is no mode "${id}". Modes: ${allModes(data).join(', ')}.`);
  }
  return id;
}

const editOf = (data: VibeData, id: string): Edit => (data.customization.edits[id] ??= {});

const visibleCount = (data: VibeData) =>
  allModes(data).filter((id) => !data.customization.edits[id]?.hidden && !data.customization.edits[id]?.deleted).length;

function text(value: string, field: keyof typeof TEXT_LIMITS): string {
  if (value.length > TEXT_LIMITS[field]) {
    throw new ToolError(`${field} can be at most ${TEXT_LIMITS[field]} characters.`);
  }
  return value;
}

/* ── Reading ───────────────────────────────────────────────────────────── */

/** Everything an assistant needs to talk about the visitor's modes. */
export function overview(data: VibeData) {
  const { edits, added, order } = data.customization;
  return {
    modes: allModes(data).map((id) => {
      const edit = edits[id] ?? {};
      const base = baseOf(data, id) as string;
      const removed = new Set(edit.removedPlaylists ?? []);
      return {
        id,
        ...(id === base ? { builtIn: true } : { copyOf: base }),
        ...(typeof edit.name === 'string' ? { name: edit.name } : {}),
        hidden: edit.hidden === true,
        deleted: edit.deleted === true,
        picture:
          edit.image === undefined ? 'default' : edit.image === null ? 'none' : edit.image === 'upload' ? 'uploaded' : edit.image,
        playlists: [
          ...(PLAYLISTS[base] ?? [])
            .filter((playlist) => !removed.has(playlist.id))
            .map((playlist) => ({
              id: playlist.id,
              name: edit.playlistNames?.[playlist.id] ?? playlist.name,
              link: edit.playlistSources?.[playlist.id] ? 'yours' : 'default',
            })),
          ...(data.customPlaylists[id] ?? []).map((playlist) => ({ id: playlist.id, name: playlist.name, link: 'yours' })),
        ],
      };
    }),
    order: order.length ? order : undefined,
    addedModes: added.length,
    preferences: data.preferences,
  };
}

/* ── Modes ─────────────────────────────────────────────────────────────── */

export interface ModePatch {
  name?: string;
  shortName?: string;
  statusLine?: string;
  description?: string;
  quotes?: string[];
  colors?: Partial<Record<(typeof COLOR_KEYS)[number], string>>;
  hidden?: boolean;
  /** An http(s) URL or site path, "none" for the colour gradient, "default" for the site's picture. */
  picture?: string;
}

/** Returns true when the mode's uploaded picture should be deleted too. */
export function updateMode(data: VibeData, id: string, patch: ModePatch): { dropUpload: boolean } {
  requireMode(data, id);
  const edit = editOf(data, id);
  if (patch.name !== undefined) edit.name = text(patch.name.trim(), 'name');
  if (patch.shortName !== undefined) edit.shortName = text(patch.shortName.trim(), 'shortName');
  if (patch.statusLine !== undefined) edit.kicker = text(patch.statusLine, 'kicker');
  if (patch.description !== undefined) edit.description = text(patch.description, 'description');
  if (patch.quotes !== undefined) {
    const [count, length] = LINE_LIMITS.quotes;
    if (patch.quotes.length > count || patch.quotes.some((line) => line.length > length)) {
      throw new ToolError(`At most ${count} quotes of ${length} characters each.`);
    }
    edit.quotes = patch.quotes;
  }
  if (patch.colors) {
    for (const [key, value] of Object.entries(patch.colors)) {
      if (!(COLOR_KEYS as readonly string[]).includes(key) || typeof value !== 'string' || !HEX.test(value)) {
        throw new ToolError(`Colours are "#rrggbb" values for: ${COLOR_KEYS.join(', ')}.`);
      }
    }
    edit.colors = { ...edit.colors, ...Object.fromEntries(Object.entries(patch.colors).map(([k, v]) => [k, (v as string).toLowerCase()])) };
  }
  if (patch.hidden !== undefined) {
    if (patch.hidden && !edit.hidden && !edit.deleted && visibleCount(data) <= 1) {
      throw new ToolError('That is the last visible mode; show another one first.');
    }
    edit.hidden = patch.hidden || undefined;
  }
  let dropUpload = false;
  if (patch.picture !== undefined) {
    if (patch.picture === 'default') delete edit.image;
    else if (patch.picture === 'none') edit.image = null;
    else {
      const url = safeImageUrl(patch.picture.trim());
      if (!url) throw new ToolError('A picture must be an https:// link or a /path on this site.');
      edit.image = url;
    }
    dropUpload = true;
  }
  return { dropUpload };
}

/** A new mode copied from an existing one; returns its id. */
export function addMode(data: VibeData, copyOf: string, name?: string): string {
  requireMode(data, copyOf);
  const id = `my-${randomId(8)}`;
  const source = data.customization.edits[copyOf] ?? {};
  // Like "Make a copy" in the panel, minus an uploaded picture: that lives in
  // its own table, so the copy starts on the default picture instead.
  const edit: Edit = { ...structuredClone(source), hidden: undefined, deleted: undefined };
  if (edit.image === 'upload') delete edit.image;
  edit.name = text((name ?? `My ${typeof source.name === 'string' ? source.name : copyOf}`).trim(), 'name');
  data.customization.added.push({ id, baseId: baseOf(data, copyOf) as string });
  data.customization.edits[id] = edit;
  if (data.customization.order.length) data.customization.order.push(id);
  const own = data.customPlaylists[copyOf];
  if (own?.length) data.customPlaylists[id] = own.map((playlist) => ({ ...playlist, id: `custom-${randomId(8)}` }));
  return id;
}

/** Built-in modes go to the bin (restorable); added ones are removed. */
export function removeMode(data: VibeData, id: string): 'binned' | 'removed' {
  requireMode(data, id);
  const edit = data.customization.edits[id] ?? {};
  if (!edit.hidden && !edit.deleted && visibleCount(data) <= 1) {
    throw new ToolError('That is the last visible mode; it can’t be removed.');
  }
  if (ADDED_ID.test(id)) {
    delete data.customization.edits[id];
    data.customization.added = data.customization.added.filter((mode) => mode.id !== id);
    data.customization.order = data.customization.order.filter((item) => item !== id);
    delete data.customPlaylists[id];
    return 'removed';
  }
  editOf(data, id).deleted = true;
  return 'binned';
}

export function restoreMode(data: VibeData, id: string): void {
  requireMode(data, id);
  const edit = editOf(data, id);
  delete edit.deleted;
  delete edit.hidden;
}

/* ── Playlists ─────────────────────────────────────────────────────────── */

function source(link: string): string {
  const normalised = normaliseSource(link);
  if (!normalised) {
    throw new ToolError('That isn’t a YouTube playlist or video link (or id). Use a link with "list=" or "v=".');
  }
  return normalised;
}

export function addPlaylist(data: VibeData, modeId: string, name: string, link: string): string {
  requireMode(data, modeId);
  const id = `custom-${randomId(8)}`;
  (data.customPlaylists[modeId] ??= []).push({ id, name: name.trim().slice(0, 60) || 'My playlist', source: source(link) });
  return id;
}

export interface PlaylistPatch {
  name?: string;
  /** A new link; an empty string sends a built-in playlist back to the site's default. */
  link?: string;
  remove?: boolean;
}

export function updatePlaylist(data: VibeData, modeId: string, playlistId: string, patch: PlaylistPatch): void {
  requireMode(data, modeId);
  const own = data.customPlaylists[modeId]?.find((playlist) => playlist.id === playlistId);
  if (own) {
    if (patch.remove) {
      data.customPlaylists[modeId] = data.customPlaylists[modeId].filter((playlist) => playlist !== own);
      return;
    }
    if (patch.name !== undefined) own.name = patch.name.trim().slice(0, 60) || own.name;
    if (patch.link !== undefined) own.source = source(patch.link);
    return;
  }
  const builtIn = (PLAYLISTS[baseOf(data, modeId) as string] ?? []).some((playlist) => playlist.id === playlistId);
  if (!builtIn) throw new ToolError(`Mode "${modeId}" has no playlist "${playlistId}".`);
  const edit = editOf(data, modeId);
  if (patch.remove) {
    edit.removedPlaylists = [...new Set([...(edit.removedPlaylists ?? []), playlistId])];
    return;
  }
  if (patch.name !== undefined) edit.playlistNames = { ...edit.playlistNames, [playlistId]: patch.name.trim().slice(0, 60) };
  if (patch.link !== undefined) {
    const sources = { ...edit.playlistSources };
    if (patch.link.trim()) sources[playlistId] = source(patch.link);
    else delete sources[playlistId];
    edit.playlistSources = sources;
    // The old Settings field outranks everything; a relink is the newer intent.
    delete data.playlistOverrides[playlistId];
  }
}

export function setPreferences(data: VibeData, preferences: Partial<Record<(typeof PREFERENCE_KEYS)[number], boolean>>): void {
  data.preferences = { ...data.preferences, ...preferences };
}
