import {
  DATA_LIMIT,
  MIN_SAVE_INTERVAL_MS,
  bearer,
  caller,
  deleteProfile,
  fail,
  hashKey,
  json,
  overLimit,
  passesTurnstile,
  slowDown,
  readText,
  type Handler,
} from '../../server/lib';

// One visitor's saved changes. GET loads them, PUT saves them (creating the
// profile on a key's first save), DELETE removes the cloud copy for good.
// The browser keeps its own copy too; see src/sync/.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const onRequestGet: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');

  const [profiles, stills] = await env.DB.batch([
    env.DB.prepare('SELECT data, version FROM profiles WHERE id = ?').bind(who.profileId),
    env.DB.prepare('SELECT mode_id, still FROM uploads WHERE profile_id = ?').bind(who.profileId),
  ]);
  const profile = profiles.results[0] as { data: string; version: number } | undefined;
  if (!profile) return fail(401, 'Unknown key.');

  const uploads = Object.fromEntries(
    (stills.results as { mode_id: string; still: string }[]).map((row) => [row.mode_id, row.still]),
  );
  return json({ data: JSON.parse(profile.data), uploads, version: profile.version });
};

export const onRequestPut: Handler = async ({ env, request }) => {
  const key = bearer(request);
  if (!key) return fail(401, 'Missing key.');

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
  const now = Date.now();

  const who = await caller(env, request);
  if (who) {
    // The version check doubles as a throttle: one write a second at most.
    const result = await env.DB.prepare(
      'UPDATE profiles SET data = ?, version = ? WHERE id = ? AND version <= ?',
    )
      .bind(data, now, who.profileId, now - MIN_SAVE_INTERVAL_MS)
      .run();
    if (!result.meta.changes) return fail(429, 'Saving too fast.');
    return json({ version: now });
  }

  // A key nobody has seen. The browser says whether it means to create a
  // profile (`create: true` on its first save). A key that was signed out
  // from another device comes with `create: false`: answering 401 tells that
  // browser it was signed out, instead of quietly starting a second, separate
  // cloud copy its other devices never see. (Missing = an older tab: allowed.)
  if (body.create === false) return fail(401, 'Unknown key.');

  // Creating a profile is the only write open to anyone, so it is the one
  // behind the bot check — and a few per address, so one script can't fill
  // the database even before Turnstile is set up.
  if (overLimit(request, 'create', 10, 10 * 60_000)) return slowDown();
  if (!(await passesTurnstile(env, request))) {
    return json({ error: 'Check needed.', challenge: true, siteKey: env.TURNSTILE_SITE_KEY ?? null }, 403);
  }
  const profileId = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO profiles (id, data, version, created_at) VALUES (?, ?, ?, ?)').bind(
        profileId,
        data,
        now,
        now,
      ),
      env.DB.prepare(
        'INSERT INTO device_keys (key_hash, profile_id, created_at) VALUES (?, ?, ?)',
      ).bind(await hashKey(key), profileId, now),
    ]);
  } catch {
    // Two first saves raced with the same key and the other one won: retrying
    // finds the profile and updates it (409, the browser retries). Anything
    // else is the database: 503, so the browser reports it instead of
    // retrying every two seconds for ever.
    const raced = await caller(env, request).catch(() => null);
    return raced ? fail(409, 'Try again.') : fail(503, 'Couldn’t save to the cloud just now. Your changes are kept here.');
  }
  return json({ version: now }, 201);
};

export const onRequestDelete: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  await deleteProfile(env, who.profileId);
  return new Response(null, { status: 204 });
};
