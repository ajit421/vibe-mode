import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { fail, type Handler } from '../../server/lib';
import { accessFor, buildServer } from '../../server/mcp';

// The MCP endpoint, two ways in:
//
//   https://vibe-mode.pages.dev/mcp — the visitor's personal server. The app
//   (Claude, ChatGPT…) signs in with OAuth 2.1: a request without a token is
//   answered 401 with `WWW-Authenticate` pointing at the protected-resource
//   metadata (public/.well-known/), from which the app finds /authorize, where
//   the visitor signs in with Google and approves (functions/api/oauth/*).
//   The token it gets is a device key of their profile, sent as
//   `Authorization: Bearer`; "Sign out other devices" revokes it.
//
//   https://vibe-mode.pages.dev/mcp/<secret> — the secret in the path is the
//   credential: the owner's MCP_ADMIN_TOKEN (site-default tools), or a device
//   key from before OAuth. Kept because some apps take only a plain URL.
//
// Stateless Streamable HTTP with JSON responses: a fresh server per POST, no
// sessions to keep, so it fits a Pages Function. GET (server-sent events)
// isn't offered, which the protocol allows. CORS is open so browser-based MCP
// clients (the MCP Inspector) can connect; the token, not the origin, is the check.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
};

const withCors = (response: Response): Response => {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

export const onRequest: Handler = async ({ env, request, params }) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const parts = ([] as string[]).concat(params.path ?? []);
  let secret: string | null = null;
  if (parts.length === 0) {
    secret = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1] ?? null;
  } else if (parts.length === 1) {
    secret = parts[0];
  } else {
    return withCors(fail(404, 'Use https://vibe-mode.pages.dev/mcp'));
  }

  const access = secret ? await accessFor(env, secret) : null;
  if (!access) {
    if (parts.length === 0) {
      // Tells the app where to sign in (RFC 9728); it then runs OAuth.
      const metadata = `${new URL(request.url).origin}/.well-known/oauth-protected-resource`;
      return withCors(
        new Response(JSON.stringify({ error: 'Sign in with Google to connect Vibe Mode.' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': `Bearer resource_metadata="${metadata}"`,
          },
        }),
      );
    }
    return withCors(fail(401, 'This MCP link isn’t valid any more. Connect again with https://vibe-mode.pages.dev/mcp'));
  }
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { ...CORS, Allow: 'POST' } });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await buildServer(env, access).connect(transport);
  return withCors(await transport.handleRequest(request));
};
