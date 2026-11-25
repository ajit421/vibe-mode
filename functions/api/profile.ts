import {
  DATA_LIMIT,
  MIN_SAVE_INTERVAL_MS,
  bearer,
  caller,
  fail,
  hashKey,
  json,
  passesTurnstile,
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

  // A key nobody has seen: this save creates the profile. It is the only
  // write open to anyone, so it is the one behind the bot check.
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
    // Two first saves raced with the same key; the other one won. Retrying
    // finds the profile and updates it.
    return fail(409, 'Try again.');
  }
  return json({ version: now }, 201);
};

export const onRequestDelete: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  const id = who.profileId;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM uploads WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM passkeys WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM logins WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM google_accounts WHERE profile_id = ?').bind(id),
    // The account's activity history goes too; its visits stay only as anonymous counts.
    env.DB.prepare('DELETE FROM profile_listens WHERE profile_id = ?').bind(id),
    env.DB.prepare('UPDATE sessions SET profile_id = NULL, events = NULL WHERE profile_id = ?').bind(id),
    env.DB.prepare('UPDATE listeners SET profile_id = NULL WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM device_keys WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM remote_commands WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM remote_state WHERE profile_id = ?').bind(id),
    env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(id),
  ]);
  return new Response(null, { status: 204 });
};
