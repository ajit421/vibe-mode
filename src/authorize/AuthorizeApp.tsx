import { useEffect, useState } from 'react';
import { GoogleButton } from '@/components/account/GoogleButton';

/*
 * The OAuth "authorize" step for the personal MCP server (/mcp): an app such
 * as Claude or ChatGPT sends the visitor here with its client id, return
 * address, PKCE challenge and state. The page checks the app is registered
 * for that address (never redirecting to one it didn't register), says what
 * it will be able to do, and on "Continue with Google" asks the server for a
 * one-time code (functions/api/oauth/authorize.ts), then sends the visitor back.
 */

type Phase =
  | { kind: 'checking' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; app: string; clientId: string; note?: string }
  | { kind: 'sending' }
  | { kind: 'done'; app: string };

const params = new URLSearchParams(window.location.search);
const request = {
  response_type: params.get('response_type'),
  client_id: params.get('client_id'),
  redirect_uri: params.get('redirect_uri'),
  state: params.get('state'),
  code_challenge: params.get('code_challenge'),
  code_challenge_method: params.get('code_challenge_method'),
};

async function getJson<T>(url: string): Promise<{ ok: boolean; body: T & { error?: string } }> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return { ok: response.ok, body: await response.json() };
  } catch {
    return { ok: false, body: { error: 'You seem to be offline.' } as T & { error?: string } };
  }
}

/** Back to the app with "the visitor said no" — only to an address the app registered. */
function deny() {
  const back = new URL(request.redirect_uri as string);
  back.searchParams.set('error', 'access_denied');
  if (request.state) back.searchParams.set('state', request.state);
  window.location.assign(back.toString());
}

export function AuthorizeApp() {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });

  useEffect(() => {
    if (request.response_type !== 'code' || !request.client_id || !request.redirect_uri) {
      setPhase({ kind: 'error', message: 'This link is missing what an app needs to connect. Start again from the app.' });
      return;
    }
    if (request.code_challenge_method !== 'S256' || !request.code_challenge) {
      setPhase({ kind: 'error', message: 'This app didn’t send a secure (PKCE S256) request, so it can’t connect.' });
      return;
    }
    void (async () => {
      const query = new URLSearchParams({ client_id: request.client_id!, redirect_uri: request.redirect_uri! });
      const [client, google] = await Promise.all([
        getJson<{ name: string | null }>(`/api/oauth/client?${query}`),
        getJson<{ clientId: string | null }>('/api/google'),
      ]);
      if (!client.ok) return setPhase({ kind: 'error', message: client.body.error ?? 'This app can’t connect.' });
      if (!google.ok || !google.body.clientId) {
        return setPhase({ kind: 'error', message: 'Google sign-in isn’t set up on this site yet.' });
      }
      setPhase({ kind: 'ready', app: client.body.name ?? 'An AI app', clientId: google.body.clientId });
    })();
  }, []);

  const approve = async (credential: string, app: string, clientId: string) => {
    setPhase({ kind: 'sending' });
    try {
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, credential }),
      });
      const body = (await response.json()) as { redirect?: string; error?: string };
      if (!response.ok || !body.redirect) {
        setPhase({ kind: 'ready', app, clientId, note: body.error ?? 'That didn’t work. Try again.' });
        return;
      }
      setPhase({ kind: 'done', app });
      window.location.assign(body.redirect);
    } catch {
      setPhase({ kind: 'ready', app, clientId, note: 'You seem to be offline. Try again.' });
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl shadow-black/50 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10" />
          <div>
            <p className="text-xs tracking-widest text-zinc-500 uppercase">Vibe Mode</p>
            <h1 className="text-lg font-semibold text-zinc-50">Connect an AI assistant</h1>
          </div>
        </div>

        {phase.kind === 'checking' && <p className="text-sm text-zinc-400">Checking the app…</p>}

        {phase.kind === 'error' && (
          <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            {phase.message}
          </p>
        )}

        {(phase.kind === 'ready' || phase.kind === 'sending') && (
          <>
            <p className="text-base text-zinc-200">
              <strong className="text-zinc-50">{phase.kind === 'ready' ? phase.app : 'The app'}</strong> wants to use your
              Vibe Mode. It will be able to:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
              <li>• See and change your modes, playlists and settings</li>
              <li>• Play, pause, skip and switch mode in tabs you let it control</li>
              <li>• See what’s playing in those tabs</li>
            </ul>
            <p className="mt-3 text-xs text-zinc-500">
              Sign in with the Google account you use on Vibe Mode. You can disconnect it any time: Account →
              Sign out other devices.
            </p>
            {phase.kind === 'ready' && phase.note && (
              <p role="alert" className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                {phase.note}
              </p>
            )}
            <div className="mt-6 flex flex-col items-center gap-3">
              {phase.kind === 'ready' ? (
                <GoogleButton
                  clientId={phase.clientId}
                  onCredential={(credential) => void approve(credential, phase.app, phase.clientId)}
                />
              ) : (
                <p className="text-sm text-zinc-400" role="status">
                  Connecting…
                </p>
              )}
              <button
                type="button"
                onClick={deny}
                disabled={phase.kind === 'sending'}
                className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {phase.kind === 'done' && (
          <p className="text-sm text-emerald-300" role="status">
            Connected. Taking you back to {phase.app}…
          </p>
        )}
      </div>
    </main>
  );
}
