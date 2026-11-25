import { fail, json, type Handler } from '../../../server/lib';
import { clientFor } from '../../../server/oauth';

// For the /authorize page: which app is asking (its registered name), and
// whether the redirect it gave is one it registered. A bad pair is shown as
// an error on the page — never redirected to, or a stranger could send a
// visitor's code anywhere.

export const onRequestGet: Handler = async ({ env, request }) => {
  const url = new URL(request.url);
  const client = await clientFor(env, url.searchParams.get('client_id'), url.searchParams.get('redirect_uri'));
  if (!client) return fail(400, 'This app isn’t registered with Vibe Mode, or its return address doesn’t match.');
  return json({ name: client.name });
};
