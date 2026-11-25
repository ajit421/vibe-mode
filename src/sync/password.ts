/*
 * The slow half of password hashing, done here in the browser rather than in
 * the Pages Function: 600k PBKDF2 rounds (OWASP's figure for SHA-256) take
 * ~0.1 s on a desktop and a little more on a phone — fine once per sign-in,
 * but far over the 10 ms of CPU a free-plan Function gets (even 100k rounds
 * measured 17 ms). The server salts and hashes this result again
 * (functions/api/login.ts), so the database never holds what is sent, and a
 * stolen copy still costs an attacker the full 600k rounds per guess.
 *
 * The salt is the username under a fixed label — not the site's origin, so a
 * domain move doesn't change every password. Changing the label or the
 * rounds breaks every existing login.
 */

const ROUNDS = 600_000;
const LABEL = 'vibe-mode/login/';

/** Usernames are case-insensitive and trimmed, here and on the server. */
export const normaliseUsername = (username: string): string => username.trim().toLowerCase();

/** What is sent instead of the password: 43 base64url characters. Throws without WebCrypto (plain http). */
export async function stretchPassword(username: string, password: string): Promise<string> {
  const encode = (text: string) => new TextEncoder().encode(text);
  const material = await crypto.subtle.importKey('raw', encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encode(LABEL + normaliseUsername(username)), iterations: ROUNDS },
    material,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
