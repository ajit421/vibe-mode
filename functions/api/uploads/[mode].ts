import {
  MAX_IMAGE_LENGTH,
  SAFE_ID,
  UPLOAD_BUDGET,
  signedIn,
  fail,
  isStill,
  json,
  overLimit,
  readText,
  slowDown,
  type Env,
  type Handler,
} from '../../../server/lib';

// One uploaded picture for one mode: PUT saves it (body is the `data:image/…`
// URL as plain text), DELETE removes it. Same limits as the browser applies:
// 1.5 MB each, 3.5 MB per visitor.

export const onRequestPut: Handler = async ({ env, request, params }) => {
  const mode = String(params.mode);
  if (!SAFE_ID.test(mode)) return fail(400, 'Unknown mode.');
  // Pictures are the biggest thing in the database: a steady trickle, not a flood.
  if (overLimit(request, 'upload', 60, 10 * 60_000)) return slowDown();
  const who = await signedIn(env, request);
  if (who instanceof Response) return who;

  const still = await readText(request, MAX_IMAGE_LENGTH);
  if (still === null) return fail(413, 'Picture too large.');
  if (!isStill(still)) return fail(400, 'Not a picture.');

  const others = await env.DB.prepare(
    'SELECT COALESCE(SUM(LENGTH(still)), 0) AS total FROM uploads WHERE profile_id = ? AND mode_id <> ?',
  )
    .bind(who.profileId, mode)
    .first<number>('total');
  if ((others ?? 0) + still.length > UPLOAD_BUDGET) return fail(413, 'No room left for pictures.');

  await env.DB.prepare(
    `INSERT INTO uploads (profile_id, mode_id, still) VALUES (?, ?, ?)
     ON CONFLICT (profile_id, mode_id) DO UPDATE SET still = excluded.still`,
  )
    .bind(who.profileId, mode, still)
    .run();
  return json({ ok: true, version: await touch(env, who.profileId) });
};

/**
 * A picture change is a change: other devices (and an AI-controlled tab) only
 * re-load the cloud copy when `profiles.version` moves, and replacing one
 * upload with another leaves the profile's data identical — so without this
 * the new picture never reached them.
 */
async function touch(env: Env, profileId: string): Promise<number> {
  const version = await env.DB.prepare('UPDATE profiles SET version = MAX(version, ?) WHERE id = ? RETURNING version')
    .bind(Date.now(), profileId)
    .first<number>('version');
  return version ?? Date.now();
}

export const onRequestDelete: Handler = async ({ env, request, params }) => {
  const mode = String(params.mode);
  if (!SAFE_ID.test(mode)) return fail(400, 'Unknown mode.');
  const who = await signedIn(env, request);
  if (who instanceof Response) return who;
  await env.DB.prepare('DELETE FROM uploads WHERE profile_id = ? AND mode_id = ?')
    .bind(who.profileId, mode)
    .run();
  return json({ version: await touch(env, who.profileId) });
};
