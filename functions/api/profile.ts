import {
  DATA_LIMIT,
  MIN_SAVE_INTERVAL_MS,
  caller,
  deleteProfile,
  fail,
  json,
  readText,
  signedIn,
  type Handler,
} from '../../server/lib';

// One visitor's cloud copy. GET loads it, PUT saves it, DELETE removes it for
// good. Cloud save is for visitors signed in with Google: GET and PUT go
// through `signedIn` (401 unknown key, 403 not signed in with Google). A
// profile is only ever created by a Google sign-in (functions/api/google.ts),
// never by a save — so strangers can't fill the database with copies.
// The browser keeps its own copy too; see src/sync/.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const onRequestGet: Handler = async ({ env, request }) => {
  const who = await signedIn(env, request);
  if (who instanceof Response) return who;

  const [profiles, stills] = await env.DB.batch([
    env.DB.prepare('SELECT data, version FROM profiles WHERE id = ?').bind(who.profileId),
    env.DB.prepare('SELECT mode_id, still FROM uploads WHERE profile_id = ?').bind(who.profileId),
  ]);
  const profile = profiles.results[0] as { data: string; version: number } | undefined;
  if (!profile) return fail(401, 'Unknown key.');

  const uploads = Object.fromEntries(
    (stills.results as { mode_id: string; still: string }[]).map((row) => [row.mode_id, row.still]),
  );
  // The account rides along, so the profile icon is current without a request of its own.
  return json({ data: JSON.parse(profile.data), uploads, version: profile.version, account: who.account });
};

export const onRequestPut: Handler = async ({ env, request }) => {
  const who = await signedIn(env, request);
  if (who instanceof Response) return who;

  const text = await readText(request, DATA_LIMIT);
  if (text === null) return fail(413, 'Too much to save.');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, 'Not JSON.');
  }
  // Stored as given: the browser sanitises it on the way back in, exactly
  // like a restored backup file, so nothing here can reach the page unchecked.
  if (!isRecord(body) || !isRecord(body.data)) return fail(400, 'Expected { data: {…} }.');
  const data = JSON.stringify(body.data);
  // Bytes, not characters: D1 refuses a value over ~2 MB, and 1M characters
  // of Hindi or emoji is 3-4 MB of UTF-8. Refused here with a clear 413
  // instead of a database error.
  if (new TextEncoder().encode(data).length > DATA_LIMIT) return fail(413, 'Too much to save.');

  // The version check doubles as a throttle: one write a second at most.
  const now = Date.now();
  const result = await env.DB.prepare('UPDATE profiles SET data = ?, version = ? WHERE id = ? AND version <= ?')
    .bind(data, now, who.profileId, now - MIN_SAVE_INTERVAL_MS)
    .run();
  if (!result.meta.changes) return fail(429, 'Saving too fast.');
  return json({ version: now });
};

/** Deleting your own data is always allowed, signed in with Google or not. */
export const onRequestDelete: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  await deleteProfile(env, who.profileId);
  return new Response(null, { status: 204 });
};
