import { addKey, caller, fail, json, type Handler } from '../../server/lib';

// Device keys for the caller's profile.
//   POST   mints a new key — the one a sync link carries to another device.
//   DELETE signs out every *other* device: all keys but the caller's go.
//          The way to revoke a sync link that went somewhere it shouldn't.

export const onRequestPost: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  const key = await addKey(env, who.profileId);
  if (!key) return fail(429, 'Too many devices. Sign out the other devices first.');
  return json({ key }, 201);
};

export const onRequestDelete: Handler = async ({ env, request }) => {
  const who = await caller(env, request);
  if (!who) return fail(401, 'Unknown key.');
  const result = await env.DB.prepare('DELETE FROM device_keys WHERE profile_id = ? AND key_hash <> ?')
    .bind(who.profileId, who.keyHash)
    .run();
  return json({ removed: result.meta.changes });
};
