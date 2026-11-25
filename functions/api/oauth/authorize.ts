import { fail, hashKey, json, newKey, overLimit, readText, slowDown, type Handler } from '../../../server/lib';
import { verifyGoogle } from '../../../server/google';
import { CODE_TTL_MS, PKCE, clientFor, googleProfile } from '../../../server/oauth';

// The approve step of /authorize (src/authorize/): the visitor signed in with
// Google and pressed Allow. Checks the app and its redirect, the PKCE
// challenge, and the Google token; finds (or makes) the visitor's profile;
// stores a one-time code bound to all of those; and answers with the URL to
// send the visitor back to. The token step (./token.ts) trades the code for a key.

export const onRequestPost: Handler = async ({ env, request }) => {
  if (!env.GOOGLE_CLIENT_ID) return fail(503, 'Google sign-in isn’t set up on this site yet.');
  if (overLimit(request, 'oauth-authorize', 30, 10 * 60_000)) return slowDown();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse((await readText(request, 10_000)) ?? '');
  } catch {
    return fail(400, 'Bad request.');
  }
  const { credential, client_id, redirect_uri, code_challenge, code_challenge_method, state } = body ?? {};

  const client = await clientFor(env, client_id, redirect_uri);
  if (!client) return fail(400, 'This app isn’t registered with Vibe Mode, or its return address doesn’t match.');
  if (code_challenge_method !== 'S256' || typeof code_challenge !== 'string' || !PKCE.test(code_challenge)) {
    return fail(400, 'The app didn’t send a valid PKCE challenge (S256 is required).');
  }
  if (typeof credential !== 'string') return fail(400, 'Bad request.');
  const google = await verifyGoogle(credential, env.GOOGLE_CLIENT_ID);
  if (!google) return fail(401, 'Google couldn’t confirm that sign-in. Try again.');

  const { profileId } = await googleProfile(env, google);
  const code = newKey();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_codes WHERE expires_at < ?').bind(now),
    env.DB.prepare(
      `INSERT INTO oauth_codes (code_hash, client_id, profile_id, redirect_uri, challenge, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(await hashKey(code), client_id, profileId, redirect_uri, code_challenge, now + CODE_TTL_MS),
  ]);

  const back = new URL(redirect_uri as string);
  back.searchParams.set('code', code);
  if (typeof state === 'string') back.searchParams.set('state', state);
  // RFC 9207: says which server issued the code, against mix-up attacks.
  back.searchParams.set('iss', new URL(request.url).origin);
  return json({ redirect: back.toString(), name: client.name, account: google.email });
};
