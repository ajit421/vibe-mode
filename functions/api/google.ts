import {
  DATA_LIMIT,
  accountOf,
  addKey,
  caller,
  fail,
  json,
  overLimit,
  readText,
  retireCallerKey,
  slowDown,
  type Account,
  type Handler,
} from '../../server/lib';
import { verifyGoogle, type GoogleAccount } from '../../server/google';
import { googleProfile } from '../../server/oauth';

// "Continue with Google" — the way into a cloud account, and the only way one
// is created (migrations/0010_google_only.sql). Optional: the site works fully
// without it; only the cloud features ("premium") need it.
//   GET   { clientId, account }: whether Google sign-in is set up here, and the
//         Google account the caller's profile is signed in with (if any).
//   POST  { credential, data? } — a Google ID token from the browser:
//         - the account already has a profile → a key for it (`key`, not
//           `created`): this browser signs in; its old key, if any, retires.
//           The browser then asks whether to load the account's modes or keep
//           its own (src/state/SyncProvider.tsx).
//         - a new account, and the caller has a cloud copy from before Google
//           → that copy is linked (`linked`): nothing is lost.
//         - a new account otherwise → a profile is created from `data` (this
//           browser's modes) with a key (`key`, `created`).
//         - the caller is already this account → `same`.
// The token is the proof: a browser can't make one for an account it doesn't
// hold, and server/google.ts checks it was issued by Google for this site.

const NOT_SET_UP = 'Google sign-in isn’t set up on this site yet.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const accountFrom = ({ email, name, picture }: GoogleAccount): Account => ({ email, name, picture });

export const onRequestGet: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  const account = who ? await accountOf(env, who.profileId) : null;
  return json({ clientId: env.GOOGLE_CLIENT_ID ?? null, account });
};

export const onRequestPost: Handler = async ({ env, request }) => {
  if (!env.GOOGLE_CLIENT_ID) return fail(503, NOT_SET_UP);
  if (overLimit(request, 'google', 30, 10 * 60_000)) return slowDown();

  let body: { credential?: unknown; data?: unknown };
  try {
    body = JSON.parse((await readText(request, DATA_LIMIT + 10_000)) ?? '');
  } catch {
    return fail(400, 'Bad request.');
  }
  if (typeof body?.credential !== 'string') return fail(400, 'Bad request.');

  const google = await verifyGoogle(body.credential, env.GOOGLE_CLIENT_ID);
  if (!google) return fail(401, 'Google couldn’t confirm that sign-in. Try again.');
  const account = accountFrom(google);

  const who = await caller(env, request);
  const linked = await env.DB.prepare('SELECT profile_id FROM google_accounts WHERE sub = ?')
    .bind(google.sub)
    .first<string>('profile_id');

  if (linked) {
    // Keep what the icon shows current: names and pictures change on Google's side.
    await env.DB.prepare('UPDATE google_accounts SET email = ?, name = ?, picture = ? WHERE sub = ?')
      .bind(google.email, google.name, google.picture, google.sub)
      .run();
    if (who?.profileId === linked) return json({ same: true, account });
    const key = await addKey(env, linked);
    if (!key) return fail(429, 'Too many devices. Sign out the other devices from one you have.');
    await retireCallerKey(env, request);
    return json({ key, account });
  }

  // A Google account new to the site. A cloud copy from before Google became
  // the way in is linked as it is, keeping its modes and its key.
  if (who && !(await accountOf(env, who.profileId))) {
    await env.DB.prepare(
      'INSERT INTO google_accounts (sub, profile_id, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(google.sub, who.profileId, google.email, google.name, google.picture, Date.now())
      .run();
    return json({ linked: true, account }, 201);
  }

  // Otherwise a new profile, starting from this browser's modes.
  const data = isRecord(body.data) ? JSON.stringify(body.data) : '{}';
  if (new TextEncoder().encode(data).length > DATA_LIMIT) return fail(413, 'Too much to save.');
  let made;
  try {
    made = await googleProfile(env, google, data, true);
  } catch {
    // The same Google account signed in twice at once and the other one won.
    return fail(409, 'Try again.');
  }
  await retireCallerKey(env, request);
  const version = await env.DB.prepare('SELECT version FROM profiles WHERE id = ?').bind(made.profileId).first<number>('version');
  return json({ key: made.key, account, created: true, version }, 201);
};
