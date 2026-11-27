import { json, newKey, overLimit, readText, type Handler } from '../../../server/lib';
import { CORS_HEADERS, MAX_CLIENTS, oauthError, validRedirect, withCors } from '../../../server/oauth';

// Dynamic client registration (RFC 7591): an MCP app (Claude, ChatGPT…)
// introduces itself before sending a visitor to /authorize. Public clients
// only — no secrets — so PKCE is what binds a code to the app that asked.
// Open to anyone, so limited per address and in total.

/** When registration is full, clients older than this are cleared to make room. */
const CLIENT_MAX_AGE_MS = 90 * 86_400_000;

export const onRequestOptions: Handler = async () => new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost: Handler = async ({ env, request }) => {
  if (overLimit(request, 'oauth-register', 20, 10 * 60_000)) {
    return oauthError(429, 'temporarily_unavailable', 'Too many registrations from here. Try again later.');
  }
  let body: { redirect_uris?: unknown; client_name?: unknown };
  try {
    body = JSON.parse((await readText(request, 10_000)) ?? '');
  } catch {
    return oauthError(400, 'invalid_client_metadata', 'Expected JSON.');
  }
  const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
  if (uris.length < 1 || uris.length > 5 || !uris.every(validRedirect)) {
    return oauthError(400, 'invalid_redirect_uri', 'Give 1-5 redirect URIs: https, or http on localhost.');
  }
  const name = typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim().slice(0, 80) : null;

  const now = Date.now();
  let count = await env.DB.prepare('SELECT COUNT(*) AS n FROM oauth_clients').first<number>('n');
  if ((count ?? 0) >= MAX_CLIENTS) {
    // Nothing else ever deletes a registration, and every new connection makes
    // one, so the table would fill once and refuse every assistant for good.
    // When full, old ones go: tokens don't reference a client, so a connected
    // assistant keeps working; one that registered long ago and asks to sign
    // in again is told its client is unknown, and registers anew.
    await env.DB.prepare('DELETE FROM oauth_clients WHERE created_at < ?').bind(now - CLIENT_MAX_AGE_MS).run();
    count = await env.DB.prepare('SELECT COUNT(*) AS n FROM oauth_clients').first<number>('n');
    if ((count ?? 0) >= MAX_CLIENTS) return oauthError(503, 'temporarily_unavailable', 'Registration is full.');
  }

  const clientId = newKey();
  await env.DB.prepare('INSERT INTO oauth_clients (client_id, name, redirect_uris, created_at) VALUES (?, ?, ?, ?)')
    .bind(clientId, name, JSON.stringify(uris), now)
    .run();
  return withCors(
    json(
      {
        client_id: clientId,
        client_id_issued_at: Math.floor(now / 1000),
        client_name: name ?? undefined,
        redirect_uris: uris,
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
      201,
    ),
  );
};
