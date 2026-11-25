import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Env } from './lib';
import { newKey } from './lib';
import * as config from '../functions/api/config';
import * as profile from '../functions/api/profile';
import * as uploads from '../functions/api/uploads/[mode]';
import * as keys from '../functions/api/keys';
import * as options from '../functions/api/passkeys/options';
import * as verify from '../functions/api/passkeys/verify';
import * as backgrounds from '../functions/backgrounds/[[path]]';
import * as mcp from '../functions/mcp/[[path]]';
import * as remote from '../functions/api/remote';
import * as login from '../functions/api/login';
import * as admin from '../functions/api/admin';
import * as listen from '../functions/api/listen';
import * as visit from '../functions/api/visit';
import * as session from '../functions/api/session';

/*
 * Every endpoint in functions/, run against Wrangler's local D1 (the same
 * SQLite engine `npm run preview:cf` uses), in a throwaway directory with
 * the real migrations applied. Lives in server/ because anything inside
 * functions/ would be bundled as a route.
 */

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'vibe-d1-'));
  proxy = await getPlatformProxy<Env>({ persist: { path: dir } });
  // The proxy also loads the developer's `.dev.vars`; the tests must not see
  // those secrets (a local TURNSTILE_SECRET would fail every first save, a
  // local owner key would make "no key set" look set). Each test adds its own.
  env = { DB: proxy.env.DB };
  for (const file of readdirSync('migrations').sort()) {
    const sql = readFileSync(join('migrations', file), 'utf8').replace(/--.*$/gm, '');
    for (const statement of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await env.DB.prepare(statement).run();
    }
  }
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  for (const table of ['sessions', 'listen_daily', 'events_daily', 'visits', 'listeners', 'login_failures', 'logins', 'remote_commands', 'remote_state', 'uploads', 'passkeys', 'device_keys', 'profiles', 'challenges', 'defaults']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

type Handler = (context: never) => Promise<Response> | Response;
const call = (handler: Handler, request: Request, extra: Record<string, unknown> = {}) =>
  handler({ env: { ...env, ...extra.env as object }, request, params: extra.params ?? {}, next: extra.next } as never);

const api = (path: string, init: RequestInit & { key?: string } = {}) => {
  const headers = new Headers(init.headers);
  if (init.key) headers.set('Authorization', `Bearer ${init.key}`);
  return new Request(`https://vibe-mode.pages.dev${path}`, { ...init, headers });
};

const save = (key: string, data: unknown = { app: 'vibe-mode', note: 'hi' }, extra = {}) =>
  call(profile.onRequestPut, api('/api/profile', { method: 'PUT', key, body: JSON.stringify({ data }) }), extra);

const still = (size = 100) => `data:image/webp;base64,${'A'.repeat(size)}`;

describe('/api/config — site defaults', () => {
  it('groups rows by kind and skips blank values', async () => {
    await env.DB.prepare(
      `INSERT INTO defaults (kind, id, value) VALUES
       ('playlist', 'metro-vibes', 'PL1234567890abcdef'), ('image', 'metro', '/backgrounds/metro.avif'),
       ('poster', 'metro', '  ')`,
    ).run();
    const response = await call(config.onRequestGet, api('/api/config'));
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(await response.json()).toEqual({
      playlists: { 'metro-vibes': 'PL1234567890abcdef' },
      images: { metro: '/backgrounds/metro.avif' },
      posters: {},
    });
  });

  it('answers 503, never throws, without a database', async () => {
    const response = await call(config.onRequestGet, api('/api/config'), { env: { DB: undefined } });
    expect(response.status).toBe(503);
  });
});

describe('/api/profile — cloud save', () => {
  it('creates on the first save, then loads, updates and deletes', async () => {
    const key = newKey();
    expect((await save(key)).status).toBe(201);

    const loaded = await call(profile.onRequestGet, api('/api/profile', { key }));
    expect(loaded.headers.get('Cache-Control')).toBe('no-store');
    expect(await loaded.json()).toMatchObject({ data: { note: 'hi' }, uploads: {} });

    expect((await save(key, { note: 'again' })).status).toBe(429); // one save a second
    await env.DB.prepare('UPDATE profiles SET version = version - 5000').run();
    expect((await save(key, { note: 'later' })).status).toBe(200);

    expect((await call(profile.onRequestDelete, api('/api/profile', { method: 'DELETE', key }))).status).toBe(204);
    expect((await call(profile.onRequestGet, api('/api/profile', { key }))).status).toBe(401);
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM device_keys').first<number>('n');
    expect(left).toBe(0);
  });

  it('refuses a missing or malformed key, bad JSON, and oversized data', async () => {
    const key = newKey();
    expect((await call(profile.onRequestGet, api('/api/profile'))).status).toBe(401);
    expect((await save('short-key')).status).toBe(401);
    const bad = api('/api/profile', { method: 'PUT', key, body: '{nope' });
    expect((await call(profile.onRequestPut, bad)).status).toBe(400);
    expect((await save(key, ['not', 'an', 'object'])).status).toBe(400);
    expect((await save(key, { big: 'x'.repeat(1_000_001) })).status).toBe(413);
  });

  it('never stores the key itself', async () => {
    const key = newKey();
    await save(key);
    const row = await env.DB.prepare('SELECT key_hash FROM device_keys').first<string>('key_hash');
    expect(row).toMatch(/^[0-9a-f]{64}$/);
    expect(row).not.toContain(key);
  });
});

describe('Turnstile on profile creation', () => {
  const turnstile = { env: { TURNSTILE_SECRET: 'secret', TURNSTILE_SITE_KEY: 'site-key' } };

  it('asks for the check when a new profile comes without a token', async () => {
    const response = await save(newKey(), {}, turnstile);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ challenge: true, siteKey: 'site-key' });
  });

  it('creates once Cloudflare confirms the token, and not when it refuses', async () => {
    const siteverify = vi.spyOn(globalThis, 'fetch');
    const withToken = (key: string) =>
      call(
        profile.onRequestPut,
        api('/api/profile', { method: 'PUT', key, body: '{"data":{}}', headers: { 'X-Turnstile-Token': 't' } }),
        turnstile,
      );
    siteverify.mockResolvedValueOnce(Response.json({ success: true }));
    expect((await withToken(newKey())).status).toBe(201);
    siteverify.mockResolvedValueOnce(Response.json({ success: false }));
    expect((await withToken(newKey())).status).toBe(403);
    siteverify.mockRestore();
  });
});

describe('/api/uploads/:mode — pictures', () => {
  const put = (key: string, mode: string, body: string) =>
    call(uploads.onRequestPut, api(`/api/uploads/${mode}`, { method: 'PUT', key, body }), { params: { mode } });

  it('stores raster stills only, within the per-picture and per-visitor limits', async () => {
    const key = newKey();
    expect((await put(key, 'metro', still())).status).toBe(401); // no profile yet
    await save(key);
    expect((await put(key, 'metro', still())).status).toBe(200);
    expect((await put(key, 'Bad Id', still())).status).toBe(400);
    expect((await put(key, 'metro', 'data:image/svg+xml;base64,AAAA')).status).toBe(400);
    expect((await put(key, 'metro', still(1_500_001))).status).toBe(413);

    expect((await put(key, 'metro', still(1_400_000))).status).toBe(200);
    expect((await put(key, 'office', still(1_400_000))).status).toBe(200);
    expect((await put(key, 'college', still(1_400_000))).status).toBe(413); // over 3.5 MB in all
    expect((await put(key, 'office', still(1_400_000))).status).toBe(200); // replacing counts once
  });

  it('deletes one picture', async () => {
    const key = newKey();
    await save(key);
    await put(key, 'metro', still());
    const removed = await call(
      uploads.onRequestDelete,
      api('/api/uploads/metro', { method: 'DELETE', key }),
      { params: { mode: 'metro' } },
    );
    expect(removed.status).toBe(204);
    const body = await (await call(profile.onRequestGet, api('/api/profile', { key }))).json<{ uploads: object }>();
    expect(body.uploads).toEqual({});
  });
});

describe('/api/keys — sync links and signing out', () => {
  it('a minted key reaches the same profile until the owner signs other devices out', async () => {
    const key = newKey();
    await save(key);
    const minted = await (await call(keys.onRequestPost, api('/api/keys', { method: 'POST', key }))).json<{ key: string }>();
    expect((await call(profile.onRequestGet, api('/api/profile', { key: minted.key }))).status).toBe(200);

    const out = await call(keys.onRequestDelete, api('/api/keys', { method: 'DELETE', key }));
    expect(await out.json()).toEqual({ removed: 1 });
    expect((await call(profile.onRequestGet, api('/api/profile', { key: minted.key }))).status).toBe(401);
    expect((await call(profile.onRequestGet, api('/api/profile', { key }))).status).toBe(200);
  });

  it('stops at 25 devices', async () => {
    const key = newKey();
    await save(key);
    const mint = () => call(keys.onRequestPost, api('/api/keys', { method: 'POST', key }));
    for (let i = 1; i < 25; i += 1) expect((await mint()).status).toBe(201);
    expect((await mint()).status).toBe(429);
  });
});

describe('/api/passkeys — sign-in', () => {
  const ask = (purpose: string, key?: string) =>
    call(options.onRequestPost, api('/api/passkeys/options', { method: 'POST', key, body: JSON.stringify({ purpose }) }));
  const answer = (challengeId: string, response: object) =>
    call(verify.onRequestPost, api('/api/passkeys/verify', { method: 'POST', body: JSON.stringify({ challengeId, response }) }));

  it('hands out challenges bound to the site, and needs a profile to add a passkey', async () => {
    expect((await ask('nonsense')).status).toBe(400);
    expect((await ask('register')).status).toBe(401);
    const key = newKey();
    await save(key);
    const register = await (await ask('register', key)).json<{ options: { rp: { id: string } } }>();
    expect(register.options.rp.id).toBe('vibe-mode.pages.dev');
    const login = await (await ask('login')).json<{ challengeId: string; options: { rpId: string } }>();
    expect(login.options.rpId).toBe('vibe-mode.pages.dev');
  });

  it('uses a challenge once, refuses expired ones and unknown passkeys', async () => {
    const { challengeId } = await (await ask('login')).json<{ challengeId: string }>();
    const unknown = await answer(challengeId, { id: 'nobody', rawId: 'nobody', type: 'public-key', response: {} });
    expect(unknown.status).toBe(401);
    expect((await answer(challengeId, { id: 'nobody' })).status).toBe(400); // already used

    const expired = await (await ask('login')).json<{ challengeId: string }>();
    await env.DB.prepare('UPDATE challenges SET expires_at = 0').run();
    expect((await answer(expired.challengeId, { id: 'x' })).status).toBe(400);
  });
});

describe('/api/login — username and password', () => {
  // What the browser sends: the password stretched (src/sync/password.ts), 43 base64url chars.
  const [RIGHT, OTHER, NEW] = [newKey(), newKey(), newKey()];
  const body = (username: string, proof: string) => JSON.stringify({ username, proof });
  const setLogin = (key: string, username: string, proof: string) =>
    call(login.onRequestPut, api('/api/login', { method: 'PUT', key, body: body(username, proof) }));
  const signIn = (username: string, proof: string, extra = {}) =>
    call(login.onRequestPost, api('/api/login', { method: 'POST', body: body(username, proof) }), extra);
  const nameOf = async (key: string) =>
    (await (await call(login.onRequestGet, api('/api/login', { key }))).json<{ username: string | null }>()).username;

  it('sets a login on a profile, then signs in on a new device with it', async () => {
    const key = newKey();
    expect((await setLogin(key, 'asha', RIGHT)).status).toBe(401); // no profile yet
    await save(key, { note: 'mine' });
    expect(await nameOf(key)).toBeNull();
    expect((await setLogin(key, ' Asha ', RIGHT)).status).toBe(200);
    expect(await nameOf(key)).toBe('asha');

    const answer = await signIn('ASHA', RIGHT); // usernames ignore case
    expect(answer.status).toBe(200);
    const { key: minted } = await answer.json<{ key: string }>();
    const loaded = await call(profile.onRequestGet, api('/api/profile', { key: minted }));
    expect(await loaded.json()).toMatchObject({ data: { note: 'mine' } });
  });

  it('stores neither the proof nor a hash that repeats across logins', async () => {
    const [a, b] = [newKey(), newKey()];
    await save(a);
    await save(b);
    await setLogin(a, 'one', RIGHT);
    await setLogin(b, 'two', RIGHT);
    const rows = (await env.DB.prepare('SELECT hash, salt FROM logins').all<{ hash: string; salt: string }>()).results;
    expect(rows[0].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].hash).not.toBe(rows[1].hash);
    expect(JSON.stringify(rows)).not.toContain(RIGHT);
  });

  it('refuses bad usernames, anything but a stretched proof, and a name someone else has', async () => {
    const [a, b] = [newKey(), newKey()];
    await save(a);
    await save(b);
    expect((await setLogin(a, 'no spaces', RIGHT)).status).toBe(400);
    expect((await setLogin(a, 'ab', RIGHT)).status).toBe(400);
    expect((await setLogin(a, 'asha', 'a plain password')).status).toBe(400);
    expect((await signIn('asha', 'a plain password')).status).toBe(400);
    expect((await setLogin(a, 'asha', RIGHT)).status).toBe(200);
    expect((await setLogin(b, 'ASHA', RIGHT)).status).toBe(409);
    expect(await nameOf(a)).toBe('asha'); // the failed one changed nothing
  });

  it('says the same for an unknown user and a wrong password', async () => {
    const key = newKey();
    await save(key);
    await setLogin(key, 'asha', RIGHT);
    const wrong = await signIn('asha', OTHER);
    const unknown = await signIn('nobody', RIGHT);
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it('locks a username after ten tries, even for the right password, until the window passes', async () => {
    const key = newKey();
    await save(key);
    await setLogin(key, 'asha', RIGHT);
    for (let i = 0; i < 10; i += 1) expect((await signIn('asha', OTHER)).status).toBe(401);
    expect((await signIn('asha', RIGHT)).status).toBe(429);
    await env.DB.prepare('UPDATE login_failures SET since = 0').run();
    expect((await signIn('asha', RIGHT)).status).toBe(200);
    expect((await signIn('asha', OTHER)).status).toBe(401); // a right answer reset the count
  });

  it('holds the limit when guesses arrive all at once', async () => {
    const key = newKey();
    await save(key);
    await setLogin(key, 'asha', RIGHT);
    const answers = await Promise.all(Array.from({ length: 20 }, () => signIn('asha', OTHER)));
    const statuses = answers.map((answer) => answer.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(10);
    expect(statuses.filter((status) => status === 429)).toHaveLength(10);
  });

  it('signing in again from a browser drops the key it replaces, so keys don’t pile up', async () => {
    const key = newKey();
    await save(key);
    await setLogin(key, 'asha', RIGHT);
    const again = await call(login.onRequestPost, api('/api/login', { method: 'POST', key, body: body('asha', RIGHT) }));
    const { key: minted } = await again.json<{ key: string }>();
    expect((await call(profile.onRequestGet, api('/api/profile', { key }))).status).toBe(401);
    expect((await call(profile.onRequestGet, api('/api/profile', { key: minted }))).status).toBe(200);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM device_keys').first<number>('n')).toBe(1);
  });

  it('a changed password signs out the other devices; the first one does not', async () => {
    const key = newKey();
    await save(key);
    const other = await (await call(keys.onRequestPost, api('/api/keys', { method: 'POST', key }))).json<{ key: string }>();
    expect(await (await setLogin(key, 'asha', RIGHT)).json()).toEqual({ username: 'asha', signedOut: 0 });
    expect(await (await setLogin(key, 'asha', NEW)).json()).toEqual({ username: 'asha', signedOut: 1 });
    expect((await call(profile.onRequestGet, api('/api/profile', { key: other.key }))).status).toBe(401);
    expect((await signIn('asha', RIGHT)).status).toBe(401);
    expect((await signIn('asha', NEW)).status).toBe(200);
  });

  it('removing the login, or the whole cloud copy, stops password sign-in', async () => {
    const key = newKey();
    await save(key);
    await setLogin(key, 'asha', RIGHT);
    expect((await call(login.onRequestDelete, api('/api/login', { method: 'DELETE', key }))).status).toBe(204);
    expect((await signIn('asha', RIGHT)).status).toBe(401);

    await setLogin(key, 'asha', RIGHT);
    await call(profile.onRequestDelete, api('/api/profile', { method: 'DELETE', key }));
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM logins').first<number>('n')).toBe(0);
  });

  it('asks for the bot check before counting or hashing anything', async () => {
    const response = await signIn('asha', RIGHT, { env: { TURNSTILE_SECRET: 's', TURNSTILE_SITE_KEY: 'site' } });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ challenge: true, siteKey: 'site' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM login_failures').first<number>('n')).toBe(0);
  });
});

describe('/api/admin — the owner’s view', () => {
  const OWNER = 'o'.repeat(40);
  const withOwner = { env: { MCP_ADMIN_TOKEN: OWNER } };
  const ask = (query = '', token: string | null = OWNER, extra: Record<string, unknown> = withOwner) =>
    call(
      admin.onRequestGet,
      api(`/api/admin${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      extra,
    );

  it('lets in only the owner key, and nobody when it is unset or short', async () => {
    expect((await ask('', null)).status).toBe(401);
    expect((await ask('', 'x'.repeat(40))).status).toBe(401);
    // No usable owner key on the site: said as such, not as a wrong key.
    expect((await ask('', OWNER, {})).status).toBe(503);
    expect((await ask('', 'short', { env: { MCP_ADMIN_TOKEN: 'short' } })).status).toBe(503);
    const ok = await ask();
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Cache-Control')).toBe('no-store');
  });

  it('counts visitors, lists them newest change first, and finds one by username', async () => {
    const [a, b] = [newKey(), newKey()];
    await save(a, {
      customization: { edits: { metro: { name: 'Mine' } }, added: [{ id: 'my-1', baseId: 'metro' }], order: [] },
      customPlaylists: { metro: [{ id: 'p1' }, { id: 'p2' }], office: 'not a list' }, // odd shapes must not break it
    });
    await save(b, { note: 'b' });
    await call(login.onRequestPut, api('/api/login', { method: 'PUT', key: a, body: JSON.stringify({ username: 'asha', proof: newKey() }) }));

    const body = await (await ask()).json<{
      totals: { visitors: number; logins: number; devices: number };
      visitors: { username: string | null; added_modes: number; edited_modes: number; playlists: number; devices: number }[];
      more: boolean;
    }>();
    expect(body.totals).toMatchObject({ visitors: 2, logins: 1, devices: 2 });
    expect(body.more).toBe(false);
    const asha = body.visitors.find((visitor) => visitor.username === 'asha')!;
    expect(asha).toMatchObject({ added_modes: 1, edited_modes: 1, playlists: 2, devices: 1 });

    const found = await (await ask('?q=ASH')).json<{ visitors: { username: string }[] }>();
    expect(found.visitors.map((visitor) => visitor.username)).toEqual(['asha']);
  });

  it('shows everything stored for one visitor', async () => {
    const key = newKey();
    await save(key, { note: 'héllo' });
    await call(uploads.onRequestPut, api('/api/uploads/metro', { method: 'PUT', key, body: still() }), { params: { mode: 'metro' } });
    const { visitors } = await (await ask()).json<{ visitors: { id: string; data_bytes: number }[] }>();
    // Bytes, not characters: 'é' is two bytes.
    expect(visitors[0].data_bytes).toBe(new TextEncoder().encode(JSON.stringify({ note: 'héllo' })).length);
    const detail = await (await ask(`?user=${visitors[0].id}`)).json<{
      data: unknown;
      devices: number[];
      uploads: { mode_id: string }[];
      login: unknown;
    }>();
    expect(detail.data).toEqual({ note: 'héllo' });
    expect(detail.devices).toHaveLength(1);
    expect(detail.uploads.map((upload) => upload.mode_id)).toEqual(['metro']);
    expect(detail.login).toBeNull();
    expect(JSON.stringify(detail)).not.toContain(key); // device keys never leave the database
    expect((await ask('?user=nobody')).status).toBe(404);
  });
});

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';

describe('/api/listen — anonymous "now playing"', () => {
  const ping = (body: unknown, ua = CHROME_ANDROID) =>
    call(
      listen.onRequestPost,
      api('/api/listen', { method: 'POST', body: JSON.stringify(body), headers: { 'User-Agent': ua } }),
    );
  const OWNER = 'o'.repeat(40);
  const overview = async () =>
    (await (
      await call(admin.onRequestGet, api('/api/admin', { headers: { Authorization: `Bearer ${OWNER}` } }), {
        env: { MCP_ADMIN_TOKEN: OWNER },
      })
    ).json()) as {
      totals: { playing_now: number };
      playing: { mode: string; track: string | null; browser: string; os: string; device: string }[];
    };

  it('refuses anything but a tab id and a known-shaped mode', async () => {
    expect((await ping({ mode: 'metro', playing: true })).status).toBe(400);
    expect((await ping({ tab: 'short', mode: 'metro', playing: true })).status).toBe(400);
    expect((await ping({ tab: newKey(), mode: 'Not A Mode!', playing: true })).status).toBe(400);
    expect((await call(listen.onRequestPost, api('/api/listen', { method: 'POST', body: '{nope' }))).status).toBe(400);
  });

  it('keeps one row per tab, and the admin page counts only tabs playing now', async () => {
    const [a, b] = [newKey(), newKey()];
    expect((await ping({ tab: a, mode: 'metro', modeName: 'Metro', track: 'Song one', playing: true })).status).toBe(204);
    await ping({ tab: a, mode: 'metro', modeName: 'Metro', track: 'Song two', playing: true });
    await ping({ tab: b, mode: 'office', playlist: 'Bad Id!', playing: true }); // a bad playlist is dropped, not refused
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM listeners').first<number>('n')).toBe(2);

    let seen = await overview();
    expect(seen.totals.playing_now).toBe(2);
    expect(seen.playing.find((row) => row.mode === 'metro')).toMatchObject({
      track: 'Song two',
      browser: 'Chrome',
      os: 'Android',
      device: 'mobile',
    });
    expect(JSON.stringify(seen)).not.toContain(a); // the tab id never leaves the database

    await ping({ tab: b, mode: 'office', playing: false }); // paused
    await env.DB.prepare('UPDATE listeners SET seen_at = 0 WHERE tab = ?').bind(a).run(); // gone quiet
    seen = await overview();
    expect(seen.totals.playing_now).toBe(0);
    expect(seen.playing).toEqual([]);
  });
});

describe('/api/visit — anonymous counts by browser, system, device', () => {
  const OWNER = 'o'.repeat(40);
  const open = (ua: string | null, hints: object = {}) =>
    call(
      visit.onRequestPost,
      api('/api/visit', { method: 'POST', body: JSON.stringify(hints), headers: ua ? { 'User-Agent': ua } : {} }),
    );

  it('adds one to a day-and-bucket row, keeps no header, and leaves bots out', async () => {
    expect((await open(CHROME_ANDROID)).status).toBe(204);
    await open(CHROME_ANDROID);
    await open(CHROME_ANDROID, { brave: true });
    await open(FIREFOX_LINUX);
    await open('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    await open(null);

    const rows = (await env.DB.prepare('SELECT browser, os, device, count FROM visits ORDER BY count DESC, browser').all())
      .results;
    expect(rows).toEqual([
      { browser: 'Chrome', os: 'Android', device: 'mobile', count: 2 },
      { browser: 'Brave', os: 'Android', device: 'mobile', count: 1 },
      { browser: 'Firefox', os: 'Linux', device: 'desktop', count: 1 },
    ]);
    expect(JSON.stringify(rows)).not.toContain('Mozilla'); // buckets only, never the header

    const admin_ = await call(
      admin.onRequestGet,
      api('/api/admin', { headers: { Authorization: `Bearer ${OWNER}` } }),
      { env: { MCP_ADMIN_TOKEN: OWNER } },
    );
    const body = await admin_.json<{
      totals: { visits_day: number; visits_month: number };
      visits: { browser: { name: string; n: number }[]; device: { name: string; n: number }[]; perDay: { n: number }[] };
    }>();
    expect(body.totals).toMatchObject({ visits_day: 4, visits_month: 4 });
    expect(body.visits.browser[0]).toEqual({ name: 'Chrome', n: 2 });
    expect(body.visits.device).toEqual([
      { name: 'mobile', n: 3 },
      { name: 'desktop', n: 1 },
    ]);
    expect(body.visits.perDay).toEqual([expect.objectContaining({ n: 4 })]);
  });
});

describe('/api/listen + /api/session — minutes, visit length, features used', () => {
  const OWNER = 'o'.repeat(40);
  const ping = (body: object) =>
    call(
      listen.onRequestPost,
      api('/api/listen', { method: 'POST', body: JSON.stringify(body), headers: { 'User-Agent': CHROME_ANDROID } }),
    );
  const beacon = (body: object, ua: string = CHROME_ANDROID) =>
    call(
      session.onRequestPost,
      api('/api/session', { method: 'POST', body: JSON.stringify(body), headers: { 'User-Agent': ua } }),
    );
  /** Pretends the tab's last ping was `ms` ago. */
  const rewind = (tab: string, ms: number) =>
    env.DB.prepare('UPDATE listeners SET seen_at = seen_at - ? WHERE tab = ?').bind(ms, tab).run();
  const engagement = async () =>
    (
      await (
        await call(admin.onRequestGet, api('/api/admin', { headers: { Authorization: `Bearer ${OWNER}` } }), {
          env: { MCP_ADMIN_TOKEN: OWNER },
        })
      ).json<{ engagement: Record<string, unknown> & { sessions: object[]; events: object[]; modes: object[] } }>()
    ).engagement;

  it('credits the time between pings to what was playing, and nothing for a long silence', async () => {
    const tab = newKey();
    const song = { tab, mode: 'metro', modeName: 'Metro', playlist: 'metro-vibes', playlistName: 'Metro Vibes', playing: true };
    await ping({ ...song, track: 'Song one' }); // the first ping has nothing before it
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM listen_daily').first<number>('n')).toBe(0);

    await rewind(tab, 60_000);
    await ping({ ...song, track: 'Song two' }); // the minute just past was Song one
    await rewind(tab, 30_000);
    await ping({ ...song, track: 'Song two', playing: false }); // paused: the last 30 s were Song two
    await rewind(tab, 30_000);
    await ping({ ...song, track: 'Song two', playing: false }); // paused time is not listening

    const rows = (await env.DB.prepare('SELECT track, ms, mode_name, playlist_name FROM listen_daily ORDER BY track').all())
      .results as { track: string; ms: number }[];
    expect(rows.map((row) => row.track)).toEqual(['Song one', 'Song two']);
    expect(rows[0].ms).toBeGreaterThanOrEqual(60_000);
    expect(rows[0].ms).toBeLessThan(62_000);
    expect(rows[1].ms).toBeGreaterThanOrEqual(30_000);
    expect(rows[1].ms).toBeLessThan(32_000);
    expect(rows[0]).toMatchObject({ mode_name: 'Metro', playlist_name: 'Metro Vibes' });

    const quiet = newKey();
    await ping({ ...song, tab: quiet, track: 'Song three' });
    await rewind(quiet, 10 * 60_000); // closed without a last ping, back much later
    await ping({ ...song, tab: quiet, track: 'Song three' });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM listen_daily WHERE track = 'Song three'").first<number>('n')).toBe(0);

    const seen = await engagement();
    expect(seen.modes).toEqual([expect.objectContaining({ mode: 'metro', name: 'Metro' })]);
    expect(seen.listened_ms_day).toBeGreaterThanOrEqual(90_000);
  });

  it('keeps the largest totals for a visit, adds up feature counts, and leaves bots and junk out', async () => {
    const tab = newKey();
    expect(
      (
        await beacon({
          tab,
          openMs: 120_000,
          visibleMs: 90_000,
          listenedMs: 60_000,
          firstMode: 'metro',
          events: [
            { name: 'panel', detail: 'Customize', n: 2 },
            { name: 'Bad Name!', n: 5 },
            { name: 'skip', detail: 'next', n: 3 },
          ],
        })
      ).status,
    ).toBe(204);
    // A repeated, older report changes nothing; a later one grows the totals.
    await beacon({ tab, openMs: 100_000, visibleMs: 10_000, listenedMs: 0, events: [{ name: 'panel', detail: 'Customize', n: 1 }] });
    await beacon({ tab, openMs: 300_000, visibleMs: 999_999_999, listenedMs: 61_000 }); // on screen can't exceed open

    const row = await env.DB.prepare('SELECT * FROM sessions').first<Record<string, unknown>>();
    expect(row).toMatchObject({ open_ms: 300_000, visible_ms: 300_000, listened_ms: 61_000, first_mode: 'metro', browser: 'Chrome' });
    const events = (await env.DB.prepare('SELECT name, detail, count FROM events_daily ORDER BY name').all()).results;
    expect(events).toEqual([
      { name: 'panel', detail: 'Customize', count: 3 },
      { name: 'skip', detail: 'next', count: 3 },
    ]);

    expect((await beacon({ tab: 'short', openMs: 1 })).status).toBe(400);
    await beacon({ tab: newKey(), openMs: 5_000 }, 'Mozilla/5.0 (compatible; Googlebot/2.1)');
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first<number>('n')).toBe(1);

    const seen = await engagement();
    expect(seen).toMatchObject({ sessions_day: 1, sessions_week: 1, avg_visible_ms: 300_000 });
    expect(seen.sessions).toEqual([expect.objectContaining({ visible_ms: 300_000, first_mode: 'metro' })]);
    expect(JSON.stringify(seen)).not.toContain(tab); // the tab id never leaves the database
    expect(seen.events).toContainEqual({ name: 'panel', detail: 'Customize', n: 3 });
  });
});

describe('/backgrounds/*.mp4 — byte ranges for Safari', () => {
  const bytes = new Uint8Array(100).map((_, i) => i);
  const get = (range?: string) =>
    call(backgrounds.onRequestGet, new Request('https://x.test/backgrounds/bg.mp4', { headers: range ? { Range: range } : {} }), {
      next: async () => new Response(bytes, { headers: { 'Content-Type': 'video/mp4' } }),
    });

  it('slices the requested range', async () => {
    const response = await get('bytes=10-19');
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 10-19/100');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('handles open-ended and suffix ranges, and refuses impossible ones', async () => {
    expect((await get('bytes=95-')).headers.get('Content-Range')).toBe('bytes 95-99/100');
    expect((await get('bytes=-5')).headers.get('Content-Range')).toBe('bytes 95-99/100');
    expect((await get('bytes=50-10')).status).toBe(416);
    expect((await get('bytes=200-')).status).toBe(416);
  });

  it('passes a plain request through, saying ranges are supported', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
  });
});

interface RpcResult {
  serverInfo?: { name: string };
  tools?: { name: string }[];
  isError?: boolean;
  content?: { text: string }[];
}

describe('/mcp/<secret> — the MCP server for AI assistants', () => {
  const OWNER = 'o'.repeat(40);
  let id = 0;
  const rpc = async (secret: string, method: string, params: object = {}, extra = {}) => {
    const request = new Request(`https://vibe-mode.pages.dev/mcp/${secret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
    });
    const response = await call(mcp.onRequest, request, { params: { path: [secret] }, ...extra });
    return { status: response.status, body: response.status === 200 ? await response.json<{ result: RpcResult }>() : null };
  };
  const tool = async (secret: string, name: string, args: object = {}, extra = {}) =>
    (await rpc(secret, 'tools/call', { name, arguments: args }, extra)).body!.result as Required<Pick<RpcResult, 'content'>> & RpcResult;
  const poll = async (key: string, body: object) =>
    (await call(remote.onRequestPost, api('/api/remote', { method: 'POST', key, body: JSON.stringify(body) }))).json<{
      commands: { action: string; value: string | null }[];
      version: number;
    }>();

  it('turns away unknown links and anything but POST', async () => {
    expect((await rpc(newKey(), 'initialize')).status).toBe(401);
    const key = newKey();
    await save(key);
    const get = await call(mcp.onRequest, new Request(`https://vibe-mode.pages.dev/mcp/${key}`), { params: { path: [key] } });
    expect(get.status).toBe(405);
  });

  it('speaks MCP: initialize, then lists the visitor’s tools', async () => {
    const key = newKey();
    await save(key);
    const init = await rpc(key, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    });
    expect(init.body!.result.serverInfo?.name).toBe('vibe-mode');
    const tools = (await rpc(key, 'tools/list')).body!.result.tools!.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(['get_my_vibe', 'update_mode', 'add_playlist', 'control_player']));
    expect(tools).not.toContain('set_site_default');
  });

  it('changes the visitor’s modes, and the change is what the site loads next', async () => {
    const key = newKey();
    await save(key, { app: 'vibe-mode', customization: { edits: {}, added: [], order: [] } });
    const before = await env.DB.prepare('SELECT version FROM profiles').first<number>('version');
    const result = await tool(key, 'update_mode', { mode: 'metro', name: 'AI Metro', colors: { accent: '#00ff88' } });
    expect(result.isError).toBeFalsy();
    const loaded = await (await call(profile.onRequestGet, api('/api/profile', { key }))).json<{
      data: { customization: { edits: Record<string, unknown> } };
      version: number;
    }>();
    expect(loaded.data.customization.edits.metro).toMatchObject({ name: 'AI Metro', colors: { accent: '#00ff88' } });
    expect(loaded.version).toBeGreaterThan(before!);

    const bad = await tool(key, 'update_mode', { mode: 'atlantis' });
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toMatch(/no mode "atlantis"/);
  });

  it('drives a listening tab: no tab → a clear error; tab polling → commands arrive in order', async () => {
    const key = newKey();
    await save(key);
    expect((await tool(key, 'control_player', { action: 'pause' })).content[0].text).toMatch(/No Vibe Mode tab is listening/);

    await poll(key, { state: { mode: 'metro', playing: true, track: 'Song' } });
    expect((await tool(key, 'player_status')).content[0].text).toContain('"track": "Song"');
    await tool(key, 'control_player', { action: 'pause' });
    await tool(key, 'control_player', { action: 'set_volume', value: '40' });
    expect((await tool(key, 'control_player', { action: 'set_volume', value: 'loud' })).isError).toBe(true);

    const first = await poll(key, {});
    expect(first.commands).toEqual([{ action: 'pause', value: null }, { action: 'set_volume', value: '40' }]);
    expect((await poll(key, {})).commands).toEqual([]); // taken once
  });

  it('owner link: site-default tools only, checked like the site checks them', async () => {
    const owner = { env: { MCP_ADMIN_TOKEN: OWNER } };
    expect((await rpc('o'.repeat(39) + 'x', 'tools/list', {}, owner)).status).toBe(401);
    const tools = (await rpc(OWNER, 'tools/list', {}, owner)).body!.result.tools!.map((t) => t.name);
    expect(tools).toEqual(['list_site_defaults', 'set_site_default', 'delete_site_default']);

    const set = await tool(OWNER, 'set_site_default', { kind: 'playlist', id: 'metro-vibes', value: 'https://www.youtube.com/playlist?list=PL1234567890abcdef' }, owner);
    expect(set.isError).toBeFalsy();
    const row = await env.DB.prepare("SELECT value FROM defaults WHERE id = 'metro-vibes'").first<string>('value');
    expect(row).toBe('PL1234567890abcdef');
    expect((await tool(OWNER, 'set_site_default', { kind: 'image', id: 'metro', value: 'javascript:x' }, owner)).isError).toBe(true);

    // Without the token set, the same link is nobody's.
    expect((await rpc(OWNER, 'tools/list')).status).toBe(401);
  });
});
