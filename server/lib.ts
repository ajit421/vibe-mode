import { MAX_IMAGE_LENGTH, UPLOAD_BUDGET } from '../src/themes/limits';

/*
 * Shared by the Functions in functions/api/. Lives outside functions/ so Pages
 * doesn't route it.
 *
 * Who is calling: the browser holds a random key (43 base64url chars, 256
 * bits) and sends it as `Authorization: Bearer <key>`. The database stores
 * only its SHA-256 (`device_keys.key_hash`), which maps to a profile. The key
 * *is* the credential, like a long unguessable link; see
 * migrations/0002_profiles.sql.
 *
 * Cloud features are for visitors signed in with Google (the "premium" tier):
 * a profile counts as signed in when it is linked to a Google account
 * (google_accounts). Google sign-in (functions/api/google.ts), a sync link
 * from a signed-in device, and an assistant's OAuth sign-in (/mcp) are the
 * only ways to get a key — `signedIn()` below is the gate every cloud
 * endpoint checks. Nothing here checks a password.
 */

export interface Env {
  DB: D1Database;
  /**
   * The owner's MCP key (secret, 32+ characters): `/mcp/<it>` adds the tools
   * that change the site's defaults for every visitor. Unset = no owner access.
   */
  MCP_ADMIN_TOKEN?: string;
  /** "Continue with Google" (functions/api/google.ts). Public, not secret. Unset = no Google button. */
  GOOGLE_CLIENT_ID?: string;
  /**
   * Google accounts (verified emails, comma-separated) that may open /admin by
   * signing in with Google. A Pages variable; unset = only the owner key works.
   */
  ADMIN_EMAILS?: string;
}

export type Handler = PagesFunction<Env>;

export { MAX_IMAGE_LENGTH, UPLOAD_BUDGET };
/** A profile's text data, in UTF-8 bytes. Generous — it is typed text — but bounded, and well under D1's ~2 MB per value. */
export const DATA_LIMIT = 1_000_000;
/** Device keys per profile: every browser, sync link and AI assistant sign-in mints one. */
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

const hex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export async function hashKey(key: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
}

/**
 * True when `secret` is the owner's key (MCP_ADMIN_TOKEN, 32+ characters),
 * compared as digests in constant time. Unset or short = nobody is the owner.
 * The MCP owner link and the admin panel (functions/api/admin.ts) share it.
 */
export async function isOwner(env: Env, secret: string | null | undefined): Promise<boolean> {
  const owner = env.MCP_ADMIN_TOKEN;
  if (!owner || owner.length < 32 || !secret) return false;
  const [a, b] = await Promise.all([hashKey(secret), hashKey(owner)]);
  return sameDigest(a, b);
}

/** Compares two digests without an early exit, so timing says nothing about where they differ. */
export function sameDigest(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The well-formed key the caller sent, or null. Says nothing about whether it is known. */
export function bearer(request: Request): string | null {
  const key = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  return isKey(key) ? key : null;
}

/** The caller's profile id and key hash, or null when the key is missing or unknown. */
export const caller = (env: Env, request: Request) => profileForKey(env, bearer(request));

/** The Google account a profile is signed in with, or null. */
export interface Account {
  email: string | null;
  name: string | null;
  picture: string | null;
}

export async function accountOf(env: Env, profileId: string): Promise<Account | null> {
  return env.DB.prepare('SELECT email, name, picture FROM google_accounts WHERE profile_id = ?')
    .bind(profileId)
    .first<Account>();
}

/**
 * The gate on every cloud feature: the caller's profile and its Google
 * account — or the answer to send instead. 401 = unknown key (the browser
 * forgets it). 403 { google: true } = a cloud copy from before Google became
 * the way in: the browser keeps its key, and signing in with Google links it.
 */
export async function signedIn(
  env: Env,
  request: Request,
): Promise<{ profileId: string; keyHash: string; account: Account } | Response> {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  const account = await accountOf(env, who.profileId);
  if (!account) return json({ error: 'Sign in with Google to use cloud save.', google: true }, 403);
  return { ...who, account };
}

/** Like `profileForKey`, but only for a profile signed in with Google (the MCP server's visitors). */
export async function memberForKey(
  env: Env,
  key: string | null | undefined,
): Promise<{ profileId: string; keyHash: string } | null> {
  const who = await profileForKey(env, key);
  return who && (await accountOf(env, who.profileId)) ? who : null;
}

/** The profile a device key belongs to — from a header, or from an MCP link's path. */
export async function profileForKey(
  env: Env,
  key: string | null | undefined,
): Promise<{ profileId: string; keyHash: string } | null> {
  if (!isKey(key)) return null;
  const keyHash = await hashKey(key);
  const row = await env.DB.prepare('SELECT profile_id FROM device_keys WHERE key_hash = ?')
    .bind(keyHash)
    .first<{ profile_id: string }>();
  return row ? { profileId: row.profile_id, keyHash } : null;
}

/** Mints another key for a profile (a sync link, a Google sign-in, an AI assistant). Null at the cap. */
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
 * After a sign-in has minted a new key: drops the key the signing-in browser
 * sent, which it is about to replace. Otherwise every sign-in leaves one
 * behind, and with no "sign out this browser" a profile fills up to MAX_KEYS
 * and refuses further sign-ins. Only that one key goes — other devices on
 * the old profile keep theirs.
 */
export async function retireCallerKey(env: Env, request: Request): Promise<void> {
  const key = bearer(request);
  if (!key) return;
  const left = await env.DB.prepare('DELETE FROM device_keys WHERE key_hash = ? RETURNING profile_id')
    .bind(await hashKey(key))
    .first<string>('profile_id');
  if (!left) return;
  // The profile this browser leaves: if nothing can reach it any more (no
  // other device, sync link or Google account — or old passkey/password), it is data nobody
  // can ever open again — up to 3.5 MB of pictures included — so it goes.
  const reachable = await env.DB.prepare(
    `SELECT EXISTS (SELECT 1 FROM device_keys WHERE profile_id = ?1)
         OR EXISTS (SELECT 1 FROM passkeys WHERE profile_id = ?1)
         OR EXISTS (SELECT 1 FROM logins WHERE profile_id = ?1)
         OR EXISTS (SELECT 1 FROM google_accounts WHERE profile_id = ?1) AS kept`,
  )
    .bind(left)
    .first<number>('kept');
  if (!reachable) await deleteProfile(env, left);
}

/**
 * Deletes a profile and everything that belongs to it, in one transaction.
 * Its visits stay only as anonymous counts. Shared by "Delete my cloud copy"
 * (functions/api/profile.ts) and the orphan cleanup above, so both remove the
 * same things.
 */
export async function deleteProfile(env: Env, id: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM uploads WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM passkeys WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM logins WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM google_accounts WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM profile_listens WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM oauth_codes WHERE profile_id = ?').bind(id),
    env.DB.prepare('UPDATE sessions SET profile_id = NULL, events = NULL WHERE profile_id = ?').bind(id),
    env.DB.prepare('UPDATE listeners SET profile_id = NULL WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM device_keys WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM remote_commands WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM remote_state WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(id),
  ]);
}

/*
 * shortcut: a rate limit kept in this isolate's memory, by the caller's IP.
 * The IP is never written anywhere — it is a map key for a few minutes, then
 * swept. Approximate: Cloudflare runs many isolates, each with its own counts,
 * so a script spread across them gets further than the limit says. It exists
 * because nothing better is available here: Pages has no rate-limit binding
 * (Wrangler rejects `ratelimits` for Pages), and a *.pages.dev site can't have
 * WAF rate-limiting rules (they belong to a zone you own). Move to a WAF rule
 * once the site has its own domain. Google sign-in is the real gate on accounts.
 */
const counts = new Map<string, { start: number; n: number }>();
const SWEEP_AT = 5_000;

/**
 * True when this IP has used up `max` calls to `bucket` in the last `windowMs`.
 * Requests with no IP (local tests, internal calls) are never limited.
 */
export function overLimit(request: Request, bucket: string, max: number, windowMs: number, now = Date.now()): boolean {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return false;
  const key = `${bucket}|${ip}`;
  const entry = counts.get(key);
  if (!entry || now - entry.start >= windowMs) {
    if (counts.size >= SWEEP_AT) {
      for (const [old, value] of counts) if (now - value.start >= 15 * 60_000) counts.delete(old);
      if (counts.size >= SWEEP_AT) counts.clear(); // under a flood: start over rather than grow
    }
    counts.set(key, { start: now, n: 1 });
    return false;
  }
  entry.n += 1;
  return entry.n > max;
}

/** The answer when `overLimit` says so — worded for a person, as every failure here is. */
export const slowDown = (): Response => fail(429, 'Too many requests from here. Wait a few minutes and try again.');

/** Reads a body as text, refusing anything over `limit` characters before it is all read. */
export async function readText(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > limit * 4) return null; // UTF-8 can be up to 4 bytes a character
  const text = await request.text();
  return text.length <= limit ? text : null;
}
