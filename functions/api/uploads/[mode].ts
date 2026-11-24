import {
  MAX_IMAGE_LENGTH,
  SAFE_ID,
  UPLOAD_BUDGET,
  caller,
  fail,
  isStill,
  json,
  readText,
  type Handler,
} from '../../../server/lib';

// One uploaded picture for one mode: PUT saves it (body is the `data:image/…`
// URL as plain text), DELETE removes it. Same limits as the browser applies:
// 1.5 MB each, 3.5 MB per visitor.

export const onRequestPut: Handler = async ({ env, request, params }) => {
  const mode = String(params.mode);
  if (!SAFE_ID.test(mode)) return fail(400, 'Unknown mode.');
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');

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
  return json({ ok: true });
};

export const onRequestDelete: Handler = async ({ env, request, params }) => {
  const mode = String(params.mode);
  if (!SAFE_ID.test(mode)) return fail(400, 'Unknown mode.');
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  await env.DB.prepare('DELETE FROM uploads WHERE profile_id = ? AND mode_id = ?')
    .bind(who.profileId, mode)
    .run();
  return new Response(null, { status: 204 });
};
