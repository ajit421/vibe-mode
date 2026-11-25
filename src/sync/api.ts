import type { SyncData } from './sync';
import type { Uploads } from '@/themes/customize';

/*
 * Calls to functions/api/. Every one answers with a plain result the caller
 * can switch on — never throws — because a failed save must leave the page
 * working: the browser's own copy is always there.
 */

export type ApiResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; error: string; body?: Record<string, unknown> };

/** 0 = the request never reached the site (offline, blocked). */
async function call<T>(
  method: string,
  path: string,
  key: string | null,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method,
      headers: {
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(body === undefined
          ? {}
          : { 'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    // Only JSON counts as an answer: the SPA fallback answers unknown paths
    // (a dev server, a deploy without functions) with index.html and a 200.
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const parsed = isJson ? ((await response.json()) as Record<string, unknown>) : undefined;
    if (response.ok && (isJson || response.status === 204)) {
      return { ok: true, status: response.status, body: parsed as T };
    }
    return {
      ok: false,
      status: isJson ? response.status : 0,
      error: typeof parsed?.error === 'string' ? parsed.error : 'Couldn’t reach the site.',
      body: parsed,
    };
  } catch {
    return { ok: false, status: 0, error: 'You seem to be offline.' };
  }
}

export interface Profile {
  data: SyncData;
  uploads: Uploads;
  version: number;
}

export const loadProfile = (key: string) => call<Profile>('GET', '/api/profile', key);

export const saveProfile = (key: string, data: SyncData, turnstileToken?: string) =>
  call<{ version: number }>(
    'PUT',
    '/api/profile',
    key,
    { data },
    turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : {},
  );

export const deleteProfile = (key: string) => call<null>('DELETE', '/api/profile', key);

export const saveUpload = (key: string, modeId: string, still: string) =>
  call<{ ok: true }>('PUT', `/api/uploads/${encodeURIComponent(modeId)}`, key, still);

export const deleteUpload = (key: string, modeId: string) =>
  call<null>('DELETE', `/api/uploads/${encodeURIComponent(modeId)}`, key);

export const mintKey = (key: string) => call<{ key: string }>('POST', '/api/keys', key);

export const signOutOthers = (key: string) => call<{ removed: number }>('DELETE', '/api/keys', key);

export interface RemoteCommand {
  action: string;
  value: string | null;
}

/** A listening tab's poll: report what's playing (only when it changed), collect queued commands. */
export const pollRemote = (key: string, state?: Record<string, unknown>) =>
  call<{ commands: RemoteCommand[]; version: number | null }>(
    'POST',
    '/api/remote',
    key,
    state === undefined ? {} : { state },
  );

export const passkeyOptions = (purpose: 'register' | 'login', key: string | null) =>
  call<{ challengeId: string; options: unknown }>('POST', '/api/passkeys/options', key, { purpose });

export const passkeyVerify = (challengeId: string, response: unknown, key: string | null) =>
  call<{ ok?: true; key?: string }>('POST', '/api/passkeys/verify', key, { challengeId, response });

/** The caller's sign-in username, or null when none is set. */
export const getLogin = (key: string) => call<{ username: string | null }>('GET', '/api/login', key);

/** `proof` is the stretched password (./password.ts), never the password itself. */
export const setLogin = (key: string, username: string, proof: string) =>
  call<{ username: string; signedOut: number }>('PUT', '/api/login', key, { username, proof });

export const removeLogin = (key: string) => call<null>('DELETE', '/api/login', key);

/**
 * A right password answers with a fresh device key, like a passkey sign-in.
 * `key` is this browser's current one, if any: the server drops it, since the new one replaces it.
 */
export const passwordLogin = (username: string, proof: string, key: string | null, turnstileToken?: string) =>
  call<{ key: string }>(
    'POST',
    '/api/login',
    key,
    { username, proof },
    turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : {},
  );
