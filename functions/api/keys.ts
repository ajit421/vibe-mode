import { addKey, caller, fail, json, signedIn, type Handler } from '../../server/lib';

// Device keys for the caller's profile.
//   POST          mints a new key — the one a sync link carries to another
//                 device. Signed in with Google only (`signedIn`).
//   DELETE        signs out every *other* device: all keys but the caller's
//                 go — browsers, sync links and AI assistants alike. The way
//                 to revoke a link that went somewhere it shouldn't.
//   DELETE ?self  signs out just this browser: its own key goes. Allowed for
//                 any key — leaving is never gated.

export const onRequestPost: Handler = async ({ env, request }) => {
  const who = await signedIn(env, request);
  if (who instanceof Response) return who;
  const key = await addKey(env, who.profileId);
  if (!key) return fail(429, 'Too many devices. Sign out the other devices first.');
  return json({ key }, 201);
};

export const onRequestDelete: Handler = async ({ env, request }) => {
  if (new URL(request.url).searchParams.has('self')) {
    const who = await caller(env, request);
    if (who) await env.DB.prepare('DELETE FROM device_keys WHERE key_hash = ?').bind(who.keyHash).run();
    return new Response(null, { status: 204 });
  }
  const who = await signedIn(env, request);
  if (who instanceof Response) return who;
  // Unused assistant sign-in codes go too: one issued in the last five minutes
  // could otherwise still be traded at /api/oauth/token for a fresh key.
  const [result] = await env.DB.batch([
    env.DB.prepare('DELETE FROM device_keys WHERE profile_id = ? AND key_hash <> ?').bind(who.profileId, who.keyHash),
    env.DB.prepare('DELETE FROM oauth_codes WHERE profile_id = ?').bind(who.profileId),
  ]);
  return json({ removed: result.meta.changes });
};
