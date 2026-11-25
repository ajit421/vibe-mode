import type { Account, SyncData } from './sync';
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
  /** The Google account the profile is signed in with — for the profile icon. */
  account: Account | null;
}

export const loadProfile = (key: string) => call<Profile>('GET', '/api/profile', key);

export const saveProfile = (key: string, data: SyncData) => call<{ version: number }>('PUT', '/api/profile', key, { data });

export const deleteProfile = (key: string) => call<null>('DELETE', '/api/profile', key);

export const saveUpload = (key: string, modeId: string, still: string) =>
  call<{ ok: true }>('PUT', `/api/uploads/${encodeURIComponent(modeId)}`, key, still);

export const deleteUpload = (key: string, modeId: string) =>
  call<null>('DELETE', `/api/uploads/${encodeURIComponent(modeId)}`, key);

export const mintKey = (key: string) => call<{ key: string }>('POST', '/api/keys', key);

export const signOutOthers = (key: string) => call<{ removed: number }>('DELETE', '/api/keys', key);

/** This browser's key only: signing out here. */
export const signOutSelf = (key: string) => call<null>('DELETE', '/api/keys?self', key);

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

/** Whether Google sign-in is set up here (`clientId`), and the account this browser's profile is signed in with. */
export const googleStatus = (key: string | null) =>
  call<{ clientId: string | null; account: Account | null }>('GET', '/api/google', key);

export interface GoogleSignIn {
  /** A key for the account's profile: this browser is signed in (see `created`). */
  key?: string;
  /** The account's profile was made just now, from this browser's modes. */
  created?: true;
  /** The version of the profile made just now. */
  version?: number;
  /** This browser's cloud copy from before Google was linked to the account. */
  linked?: true;
  /** This browser was already signed in with this account. */
  same?: true;
  account: Account;
}

/**
 * Sign in with a Google ID token. `data` is this browser's modes: a Google
 * account new to the site starts from them. See functions/api/google.ts.
 */
export const googleSignIn = (credential: string, key: string | null, data: SyncData) =>
  call<GoogleSignIn>('POST', '/api/google', key, { credential, data });
