import { addKey, caller, fail, json, overLimit, readText, retireCallerKey, slowDown, type Handler } from '../../server/lib';
import { verifyGoogle } from '../../server/google';

// "Continue with Google" (migrations/0008_google.sql). Optional, never a wall.
//   GET    { clientId, email }: whether Google sign-in is set up, and which
//          Google account the caller's profile is linked to (with a key).
//   POST   { credential, replace? } — a Google ID token from the browser:
//          - linked to a profile → mint a key for it (sign in), retiring the
//            caller's key, like a passkey or password sign-in. If that would
//            replace the caller's own modes, the first answer is
//            409 { confirm: true, email }: nothing is minted until the browser
//            asks again with `replace: true` (the visitor confirmed).
//          - not linked, caller has a cloud copy → link it to that profile.
//          - not linked, no cloud copy → 404 { link: true }: the browser saves
//            first (creating its profile) and asks again.
//   DELETE unlink the caller's Google account (keys and passkeys keep working).
//
// The token is the proof: a browser can't make one for an account it doesn't
// hold, and server/google.ts checks it was issued by Google for this site.

const NOT_SET_UP = 'Google sign-in isn’t set up on this site yet.';

export const onRequestGet: Handler = async ({ env, request }) => {
  const clientId = env.GOOGLE_CLIENT_ID ?? null;
  const who = await caller(env, request);
  // A row, not just its email: a linked account whose email Google didn't verify has none.
  const row = who
    ? await env.DB.prepare('SELECT email FROM google_accounts WHERE profile_id = ?')
        .bind(who.profileId)
        .first<{ email: string | null }>()
    : null;
  return json({ clientId, email: row?.email ?? null, linked: row !== null });
};

export const onRequestPost: Handler = async ({ env, request }) => {
  if (!env.GOOGLE_CLIENT_ID) return fail(503, NOT_SET_UP);
  if (overLimit(request, 'google', 30, 10 * 60_000)) return slowDown();
  let body: { credential?: unknown; replace?: unknown };
  try {
    body = JSON.parse((await readText(request, 8_000)) ?? '');
  } catch {
    return fail(400, 'Bad request.');
  }
  if (typeof body?.credential !== 'string') return fail(400, 'Bad request.');

  const account = await verifyGoogle(body.credential, env.GOOGLE_CLIENT_ID);
  if (!account) return fail(401, 'Google couldn’t confirm that sign-in. Try again.');

  const who = await caller(env, request);
  const linked = await env.DB.prepare('SELECT profile_id FROM google_accounts WHERE sub = ?')
    .bind(account.sub)
    .first<string>('profile_id');

  if (linked) {
    if (who?.profileId === linked) return json({ same: true, email: account.email });
    // Signing in here would swap this browser's own cloud copy for the account's.
    if (who && body.replace !== true) return json({ error: 'Confirm first.', confirm: true, email: account.email }, 409);
    const key = await addKey(env, linked);
    if (!key) return fail(429, 'Too many devices. Sign out the other devices from one you have.');
    await retireCallerKey(env, request);
    // Keep the shown email current: it can change on Google's side.
    if (account.email) {
      await env.DB.prepare('UPDATE google_accounts SET email = ? WHERE sub = ?').bind(account.email, account.sub).run();
    }
    return json({ key, email: account.email });
  }

  if (!who) return json({ error: 'Save first.', link: true }, 404);
  try {
    await env.DB.prepare('INSERT INTO google_accounts (sub, profile_id, email, created_at) VALUES (?, ?, ?, ?)')
      .bind(account.sub, who.profileId, account.email, Date.now())
      .run();
  } catch {
    // UNIQUE(profile_id): this profile already has another Google account.
    return fail(409, 'This browser’s account is already connected to another Google account. Disconnect that one first.');
  }
  return json({ linked: true, email: account.email }, 201);
};

export const onRequestDelete: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  await env.DB.prepare('DELETE FROM google_accounts WHERE profile_id = ?').bind(who.profileId).run();
  return new Response(null, { status: 204 });
};
