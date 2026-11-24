import { MAX_IMAGE_LENGTH, UPLOAD_BUDGET } from '../src/themes/limits';

/*
 * Shared by the Functions in functions/api/. Lives outside functions/ so Pages
 * doesn't route it.
 *
 * Who is calling: the browser holds a random key (43 base64url chars, 256
 * bits) and sends it as `Authorization: Bearer <key>`. The database stores
 * only its SHA-256 (`device_keys.key_hash`), which maps to a profile. No
 * account, no password: the key *is* the credential, like a long unguessable
 * link. See migrations/0002_profiles.sql.
 */

export interface Env {
  DB: D1Database;
  /** Turnstile (bot check on creating a profile). Both unset = no check. */
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
}

export type Handler = PagesFunction<Env>;

export { MAX_IMAGE_LENGTH, UPLOAD_BUDGET };
/** A profile's text data. Generous — it is typed text — but bounded. */
export const DATA_LIMIT = 1_000_000;
/** Device keys per profile: every browser, sync link and passkey sign-in mints one. */
export const MAX_KEYS = 25;
/** One profile may save at most this often; the browser waits 2s between saves anyway. */
export const MIN_SAVE_INTERVAL_MS = 1_000;

const KEY = /^[A-Za-z0-9_-]{43}$/;
export const SAFE_ID = /^[a-z0-9-]{1,60}$/;
const STILL = /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$/;

export const isKey = (value: string | null | undefined): value is string =>
  typeof value === 'string' && KEY.test(value);

export const isStill = (value: string): boolean =>
  value.length <= MAX_IMAGE_LENGTH && STILL.test(value);

/** JSON, never cached — every answer here is one visitor's private data. */
export const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export const fail = (status: number, error: string): Response => json({ error }, status);

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** A fresh device key: 32 random bytes. */
export const newKey = (): string => bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));

export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The well-formed key the caller sent, or null. Says nothing about whether it is known. */
export function bearer(request: Request): string | null {
  const key = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  return isKey(key) ? key : null;
}

/** The caller's profile id and key hash, or null when the key is missing or unknown. */
export async function caller(
  env: Env,
  request: Request,
): Promise<{ profileId: string; keyHash: string } | null> {
  const key = bearer(request);
  if (!key) return null;
  const keyHash = await hashKey(key);
  const row = await env.DB.prepare('SELECT profile_id FROM device_keys WHERE key_hash = ?')
    .bind(keyHash)
    .first<{ profile_id: string }>();
  return row ? { profileId: row.profile_id, keyHash } : null;
}

/** Mints another key for a profile (a sync link, a passkey sign-in). Null at the cap. */
export async function addKey(env: Env, profileId: string): Promise<string | null> {
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM device_keys WHERE profile_id = ?')
    .bind(profileId)
    .first<number>('n');
  if ((count ?? 0) >= MAX_KEYS) return null;
  const key = newKey();
  await env.DB.prepare('INSERT INTO device_keys (key_hash, profile_id, created_at) VALUES (?, ?, ?)')
    .bind(await hashKey(key), profileId, Date.now())
    .run();
  return key;
}

/**
 * Turnstile check for creating a profile — the one write anybody can make
 * without already holding a key. Passes when Turnstile isn't configured, so
 * the site works before the keys are set; set both TURNSTILE_* variables in
 * the Pages project to turn it on.
 */
export async function passesTurnstile(env: Env, request: Request): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  const token = request.headers.get('X-Turnstile-Token');
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const outcome = await result.json<{ success?: boolean }>();
    return outcome.success === true;
  } catch {
    return false;
  }
}

/** Reads a body as text, refusing anything over `limit` characters before it is all read. */
export async function readText(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > limit * 4) return null; // UTF-8 can be up to 4 bytes a character
  const text = await request.text();
  return text.length <= limit ? text : null;
}
