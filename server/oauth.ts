import { bytesToBase64Url, hashKey, json, newKey, type Env } from './lib';
import type { GoogleAccount } from './google';

/*
 * The small OAuth 2.1 authorization server behind the personal MCP server
 * (https://vibe-mode.pages.dev/mcp), as the MCP spec asks of a remote server:
 * metadata (public/oauth/*.json, served at /.well-known/ by public/_redirects),
 * dynamic client registration, authorization code + PKCE (S256 only), public
 * clients (no client secrets). The visitor proves who they are with Google on
 * /authorize; the access token is a device key of their profile.
 */

/** Codes live this long, and are used once. */
export const CODE_TTL_MS = 5 * 60_000;
/** Registered apps, kept bounded: registration is open to anyone. */
export const MAX_CLIENTS = 10_000;

/**
 * A redirect an app may register: https anywhere, or http on this computer
 * only (desktop apps such as Claude Desktop listen on localhost). No
 * fragments, no credentials in the URL, no other schemes.
 */
export function validRedirect(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

/** PKCE code verifier / challenge: 43-128 base64url-ish characters (RFC 7636). */
export const PKCE = /^[A-Za-z0-9\-._~]{43,128}$/;

/** The S256 challenge a verifier must hash to. */
export async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

/** A registered app, if `redirectUri` is one it registered (exact match). */
export async function clientFor(
  env: Env,
  clientId: unknown,
  redirectUri: unknown,
): Promise<{ name: string | null } | null> {
  if (typeof clientId !== 'string' || typeof redirectUri !== 'string') return null;
  const row = await env.DB.prepare('SELECT name, redirect_uris FROM oauth_clients WHERE client_id = ?')
    .bind(clientId)
    .first<{ name: string | null; redirect_uris: string }>();
  if (!row) return null;
  try {
    const allowed = JSON.parse(row.redirect_uris) as string[];
    return allowed.includes(redirectUri) ? { name: row.name } : null;
  } catch {
    return null;
  }
}

/**
 * The profile signed in with this Google account — made, empty, on its first
 * sign-in. Shared by the site's "Continue with Google" (which may also want a
 * key for the browser) and /authorize (which mints its key at the token step).
 */
export async function googleProfile(
  env: Env,
  google: GoogleAccount,
  data = '{}',
  withKey = false,
): Promise<{ profileId: string; key: string | null; created: boolean }> {
  const linked = await env.DB.prepare('SELECT profile_id FROM google_accounts WHERE sub = ?')
    .bind(google.sub)
    .first<string>('profile_id');
  if (linked) {
    await env.DB.prepare('UPDATE google_accounts SET email = ?, name = ?, picture = ? WHERE sub = ?')
      .bind(google.email, google.name, google.picture, google.sub)
      .run();
    return { profileId: linked, key: null, created: false };
  }
  const profileId = crypto.randomUUID();
  const key = withKey ? newKey() : null;
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO profiles (id, data, version, created_at) VALUES (?, ?, ?, ?)').bind(profileId, data, now, now),
    ...(key
      ? [
          env.DB.prepare('INSERT INTO device_keys (key_hash, profile_id, created_at) VALUES (?, ?, ?)').bind(
            await hashKey(key),
            profileId,
            now,
          ),
        ]
      : []),
    env.DB.prepare(
      'INSERT INTO google_accounts (sub, profile_id, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(google.sub, profileId, google.email, google.name, google.picture, now),
  ]);
  return { profileId, key, created: true };
}

/** OAuth's error shape (RFC 6749 §5.2), never cached, open to browser-based clients. */
export const oauthError = (status: number, error: string, description: string): Response =>
  withCors(json({ error, error_description: description }, status));

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function withCors(response: Response): Response {
  for (const [name, value] of Object.entries(CORS_HEADERS)) response.headers.set(name, value);
  return response;
}
