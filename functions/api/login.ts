import {
  PASSWORD_ITERATIONS,
  addKey,
  bytesToBase64Url,
  caller,
  fail,
  hashPassword,
  isKey,
  json,
  passesTurnstile,
  readText,
  sameDigest,
  type Handler,
} from '../../server/lib';
import { USERNAME_PATTERN } from '../../src/themes/limits';

// Username + password for a profile — optional, and only ever a way to get a
// device key on a new browser (see migrations/0004_logins.sql).
//   GET    the caller's username, or null
//   PUT    sets or changes the caller's username and password
//   POST   signs in: a right password mints a device key, like a passkey sign-in
//   DELETE removes the caller's login (keys, links and passkeys keep working)
//
// The password never arrives: the browser sends `proof`, the password
// stretched with 600k PBKDF2 rounds (src/sync/password.ts), and only that is
// hashed again here. So the length rules live in the browser — a visitor who
// bypasses them only weakens their own login.
//
// shortcut: no "forgot password" — there is no email to send a reset to. A
// passkey or a sync link from another device is the way back; add email
// (Cloudflare Email Sending) if visitors need more.

const USERNAME = new RegExp(`^${USERNAME_PATTERN}$`);
/** Sign-in tries a username may take per window before it is locked. */
const MAX_TRIES = 10;
const LOCKOUT_MS = 15 * 60_000;
/** Unknown usernames are hashed against this, so timing doesn't tell which names exist. */
const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA';

async function credentials(request: Request): Promise<{ username: string; proof: string } | null> {
  const text = await readText(request, 1_000);
  if (text === null) return null;
  try {
    const body = JSON.parse(text) as { username?: unknown; proof?: unknown };
    // A proof is 32 bytes as base64url — the same shape as a device key.
    if (typeof body?.username !== 'string' || !isKey(body.proof as string)) return null;
    return { username: body.username.trim().toLowerCase(), proof: body.proof as string };
  } catch {
    return null;
  }
}

export const onRequestGet: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  const username = await env.DB.prepare('SELECT username FROM logins WHERE profile_id = ?')
    .bind(who.profileId)
    .first<string>('username');
  return json({ username: username ?? null });
};

export const onRequestPut: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  const given = await credentials(request);
  if (!given) return fail(400, 'Bad request.');
  if (!USERNAME.test(given.username)) {
    return fail(400, 'A username is 3 to 30 letters, numbers, dashes or underscores.');
  }

  // No "current password" asked: whoever holds this key can already sign
  // every other device out and delete the profile, so it would guard nothing.
  const salt = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(given.proof, salt, PASSWORD_ITERATIONS);
  const had = await env.DB.prepare('SELECT 1 AS x FROM logins WHERE profile_id = ?').bind(who.profileId).first();
  try {
    // One transaction: if the name is someone else's, the old login stays.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM logins WHERE profile_id = ?').bind(who.profileId),
      env.DB.prepare(
        'INSERT INTO logins (username, profile_id, hash, salt, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind(given.username, who.profileId, hash, salt, PASSWORD_ITERATIONS, Date.now()),
    ]);
  } catch {
    // Only a name held by another profile is "taken"; anything else is the database.
    const taken = await env.DB.prepare('SELECT 1 AS x FROM logins WHERE username = ? AND profile_id <> ?')
      .bind(given.username, who.profileId)
      .first()
      .catch(() => null);
    return taken ? fail(409, 'That username is taken. Try another.') : fail(503, 'Couldn’t save that. Try again.');
  }

  // A changed password should lock out whoever knew the old one, so every
  // other device signs out. Setting the first one leaves them alone.
  let signedOut = 0;
  if (had) {
    const result = await env.DB.prepare('DELETE FROM device_keys WHERE profile_id = ? AND key_hash <> ?')
      .bind(who.profileId, who.keyHash)
      .run();
    signedOut = result.meta.changes;
  }
  return json({ username: given.username, signedOut });
};

export const onRequestPost: Handler = async ({ env, request }) => {
  const given = await credentials(request);
  if (!given) return fail(400, 'Bad request.');
  // Before any hashing: the bot check is what stops a script making us burn CPU.
  if (!(await passesTurnstile(env, request))) {
    return json({ error: 'Check needed.', challenge: true, siteKey: env.TURNSTILE_SITE_KEY ?? null }, 403);
  }
  // Every try is counted *before* checking, in one write that also reads the
  // new count. Counting only after a wrong answer let parallel requests all
  // read "0 so far" and slip past the limit together. Expired windows are
  // swept first, so a stale row restarts at 1; a right answer clears the row.
  const now = Date.now();
  const [, counted] = await env.DB.batch([
    env.DB.prepare('DELETE FROM login_failures WHERE since <= ?').bind(now - LOCKOUT_MS),
    env.DB.prepare(
      `INSERT INTO login_failures (username, count, since) VALUES (?, 1, ?)
       ON CONFLICT (username) DO UPDATE SET count = count + 1
       RETURNING count`,
    ).bind(given.username, now),
  ]);
  const tries = (counted.results[0] as { count: number } | undefined)?.count ?? Infinity;
  if (tries > MAX_TRIES) {
    return fail(429, 'Too many wrong tries. Wait 15 minutes, or sign in with a passkey or a sync link.');
  }

  const login = await env.DB.prepare('SELECT profile_id, hash, salt, iterations FROM logins WHERE username = ?')
    .bind(given.username)
    .first<{ profile_id: string; hash: string; salt: string; iterations: number }>();
  const hash = await hashPassword(given.proof, login?.salt ?? DUMMY_SALT, login?.iterations ?? PASSWORD_ITERATIONS);
  if (!login || !sameDigest(hash, login.hash)) return fail(401, 'Wrong username or password.');

  await env.DB.prepare('DELETE FROM login_failures WHERE username = ?').bind(given.username).run();
  const key = await addKey(env, login.profile_id);
  if (!key) return fail(429, 'Too many devices. Sign out the other devices from one you have.');
  return json({ key });
};

export const onRequestDelete: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  await env.DB.prepare('DELETE FROM logins WHERE profile_id = ?').bind(who.profileId).run();
  return new Response(null, { status: 204 });
};
