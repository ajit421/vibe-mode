import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { fail, type Handler } from '../../server/lib';
import { accessFor, buildServer } from '../../server/mcp';

// The MCP endpoint: https://vibe-mode.pages.dev/mcp/<secret>
//
// The secret in the path is the credential — a device key minted for the
// assistant (Customize → Cloud save → "Connect an AI assistant"), or the
// owner's MCP_ADMIN_TOKEN. A path rather than a header because Claude.ai,
// ChatGPT and Gemini all accept a plain URL; "Sign out other devices"
// revokes it like any other key.
//
// Stateless Streamable HTTP with JSON responses: a fresh server per POST, no
// sessions to keep, so it fits a Pages Function. GET (server-sent events)
// isn't offered, which the protocol allows.

export const onRequest: Handler = async ({ env, request, params }) => {
  const parts = ([] as string[]).concat(params.path ?? []);
  if (parts.length !== 1) return fail(404, 'Use /mcp/<your link’s secret>.');

  const access = await accessFor(env, parts[0]);
  if (!access) return fail(401, 'This MCP link isn’t valid any more. Make a new one in Customize → Cloud save.');
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await buildServer(env, access).connect(transport);
  return transport.handleRequest(request);
};
