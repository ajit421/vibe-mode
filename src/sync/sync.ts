import { DEFAULT_PREFERENCES, type VibeBackup } from '@/state/vibe-context';
import type { Uploads } from '@/themes/customize';
import { readStorage, writeStorage } from '@/utils/storage';

/* ══════════════════════════════════════════════════════════════════════════
 *  CLOUD SYNC — the pure parts
 *
 *  A visitor's changes are saved to D1 (functions/api/profile.ts) under a
 *  random key this browser holds. No sign-up: the key is made the first time
 *  there is something worth saving. Passing the key to another device (a sync
 *  link, phase 3) or signing in with a passkey (phase 4, which mints a new
 *  key) brings the same modes there.
 * ══════════════════════════════════════════════════════════════════════════ */

const KEY = /^[A-Za-z0-9_-]{43}$/;

export const isSyncKey = (value: unknown): value is string =>
  typeof value === 'string' && KEY.test(value);

/** 32 random bytes as base64url — the same shape the server mints. */
export function newSyncKey(): string {
  let binary = '';
  for (const byte of crypto.getRandomValues(new Uint8Array(32))) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A sync link (`…/#sync=KEY`) or a bare key, as pasted; null when it is neither. */
export function parseSyncLink(input: string): string | null {
  const trimmed = input.trim();
  const fromLink = /[#&]sync=([A-Za-z0-9_-]{43})(?:&|$)/.exec(trimmed)?.[1];
  const key = fromLink ?? trimmed;
  return isSyncKey(key) ? key : null;
}

/**
 * The link that carries a key to another device. The key rides in the `#`
 * fragment, which browsers never send to any server or in a Referer.
 */
export const syncLink = (key: string): string =>
  `${window.location.origin}${window.location.pathname}#sync=${key}`;

/**
 * FNV-1a — enough to tell "changed since the last save" apart, not a
 * security measure. Runs over each picture only when that picture changes.
 */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length.toString(36)}.${(hash >>> 0).toString(36)}`;
}

/** What is saved as the profile's text: the backup minus its pictures. */
export type SyncData = Omit<VibeBackup, 'uploads'>;

export function splitBackup(backup: VibeBackup): { data: SyncData; uploads: Uploads } {
  const { uploads = {}, ...data } = backup;
  return { data, uploads };
}

/**
 * True when there is nothing worth saving — a visitor who only looked around.
 * They get no key and no row in the database until they change something.
 */
export function isEmptyBackup(backup: VibeBackup): boolean {
  const { customization, preferences, customPlaylists, playlistOverrides, uploads = {} } = backup;
  const defaults: Record<string, unknown> = { ...DEFAULT_PREFERENCES };
  return (
    Object.keys(customization.edits).length === 0 &&
    customization.added.length === 0 &&
    customization.order.length === 0 &&
    Object.values(customPlaylists).every((list) => list.length === 0) &&
    Object.keys(playlistOverrides).length === 0 &&
    Object.keys(uploads).length === 0 &&
    Object.entries(preferences).every(([key, value]) => defaults[key] === value)
  );
}

/* ── What this browser last saved ────────────────────────────────────── */

/**
 * Kept in localStorage, shared by every open tab, so a change synced in from
 * another tab is recognised as already saved rather than saved twice, and a
 * change made offline is still known to be unsaved after a reload.
 */
/** The Google account a profile is signed in with — shown on the profile icon. */
export interface Account {
  email: string | null;
  name: string | null;
  /** https on googleusercontent.com only (server/google.ts, `safeAccount` below). */
  picture: string | null;
}

const PICTURE = /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\/[^\s"'<>]{1,500}$/;
const text = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.slice(0, max) : null);

/** An account from storage or the network, shape-checked; null when it isn't one. */
export function safeAccount(raw: unknown): Account | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const picture = typeof value.picture === 'string' && PICTURE.test(value.picture) ? value.picture : null;
  return { email: text(value.email, 254), name: text(value.name, 80), picture };
}

export interface SyncRecord {
  /** This browser's device key: it is signed in (with `account`), or holds a cloud copy from before Google. */
  key: string | null;
  /** Signed in with Google: the account. Null = not signed in, or not yet confirmed by the server. */
  account: Account | null;
  /** Fingerprint of the profile text last saved or loaded. */
  data: string | null;
  /** Mode id → fingerprint of each picture last saved or loaded. */
  uploads: Record<string, string>;
  /** The cloud copy's version when this browser last saved or loaded it. */
  version: number | null;
  /** The visitor deleted their cloud copy: stop saving until they turn it back on. */
  off: boolean;
}

/** Not in `STORAGE_KEYS`: "Start over" must not forget the key, or the cloud copy is orphaned. */
export const SYNC_STORAGE_KEY = 'vibe-mode.sync';

export const EMPTY_RECORD: SyncRecord = { key: null, account: null, data: null, uploads: {}, version: null, off: false };

export function readRecord(): SyncRecord {
  const raw = readStorage<Partial<SyncRecord>>(SYNC_STORAGE_KEY, {});
  return {
    key: isSyncKey(raw.key) ? raw.key : null,
    account: safeAccount(raw.account),
    data: typeof raw.data === 'string' ? raw.data : null,
    uploads:
      raw.uploads && typeof raw.uploads === 'object' && !Array.isArray(raw.uploads)
        ? Object.fromEntries(Object.entries(raw.uploads).filter(([, v]) => typeof v === 'string'))
        : {},
    version: typeof raw.version === 'number' ? raw.version : null,
    off: raw.off === true,
  };
}

export const writeRecord = (record: SyncRecord): void => writeStorage(SYNC_STORAGE_KEY, record);

/** Pictures to save and to delete, comparing what is here to what was last saved. */
export function diffUploads(
  current: Uploads,
  saved: Record<string, string>,
): { put: string[]; remove: string[] } {
  return {
    put: Object.keys(current).filter((id) => saved[id] !== fingerprint(current[id])),
    remove: Object.keys(saved).filter((id) => !(id in current)),
  };
}
