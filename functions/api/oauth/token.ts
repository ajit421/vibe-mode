import { addKey, hashKey, json, overLimit, type Handler } from '../../../server/lib';
import { CORS_HEADERS, PKCE, challengeOf, oauthError, withCors } from '../../../server/oauth';

// The token step (RFC 6749 §4.1.3 + PKCE): the app trades its one-time code
// for an access token. The code is deleted as it is read, so it works once;
// it must come from the same app, for the same redirect, with the verifier
// whose S256 hash was the challenge. The token is a fresh device key of the
// visitor's profile, scoped to /mcp: no expiry, revoked by "Sign out other devices" in the
// Account panel or by deleting the cloud copy. No refresh tokens — none needed.

export const onRequestOptions: Handler = async () => new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost: Handler = async ({ env, request }) => {
  if (overLimit(request, 'oauth-token', 60, 10 * 60_000)) {
    return oauthError(429, 'temporarily_unavailable', 'Too many requests from here. Try again later.');
  }
  // Form-encoded, as OAuth says; JSON accepted too.
  let fields: Record<string, string> = {};
  try {
    const type = request.headers.get('Content-Type') ?? '';
    if (type.includes('application/json')) fields = (await request.json()) as Record<string, string>;
    else fields = Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]));
  } catch {
    return oauthError(400, 'invalid_request', 'Unreadable request.');
  }
  const { grant_type, code, redirect_uri, client_id, code_verifier } = fields;
  if (grant_type !== 'authorization_code') {
    return oauthError(400, 'unsupported_grant_type', 'Only authorization_code is supported.');
  }
  if (typeof code !== 'string' || typeof code_verifier !== 'string' || !PKCE.test(code_verifier)) {
    return oauthError(400, 'invalid_request', 'code and code_verifier are required.');
  }

  const row = await env.DB.prepare(
    'DELETE FROM oauth_codes WHERE code_hash = ? RETURNING client_id, profile_id, redirect_uri, challenge, expires_at',
  )
    .bind(await hashKey(code))
    .first<{ client_id: string; profile_id: string; redirect_uri: string; challenge: string; expires_at: number }>();
  if (
    !row ||
    row.expires_at < Date.now() ||
    row.client_id !== client_id ||
    row.redirect_uri !== redirect_uri ||
    (await challengeOf(code_verifier)) !== row.challenge
  ) {
    return oauthError(400, 'invalid_grant', 'That sign-in code is invalid, used or expired. Connect again.');
  }

  // Scoped: good at /mcp only, never at the /api cloud endpoints (server/lib.ts profileForKey).
  const key = await addKey(env, row.profile_id, 'mcp');
  if (!key) return oauthError(400, 'invalid_grant', 'Too many devices. Sign out other devices in Vibe Mode first.');
  return withCors(json({ access_token: key, token_type: 'Bearer', scope: 'vibe' }));
};
