import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Env } from './lib';
import { hashKey, newKey } from './lib';
import * as config from '../functions/api/config';
import * as profile from '../functions/api/profile';
import * as uploads from '../functions/api/uploads/[mode]';
import * as keys from '../functions/api/keys';
import * as backgrounds from '../functions/backgrounds/[[path]]';
import * as mcp from '../functions/mcp/[[path]]';
import * as remote from '../functions/api/remote';
import * as admin from '../functions/api/admin';
import * as listen from '../functions/api/listen';
import * as visit from '../functions/api/visit';
import * as session from '../functions/api/session';
import * as google from '../functions/api/google';
import * as oauthRegister from '../functions/api/oauth/register';
import * as oauthClient from '../functions/api/oauth/client';
import * as oauthAuthorize from '../functions/api/oauth/authorize';
import * as oauthToken from '../functions/api/oauth/token';
import { challengeOf } from './oauth';
import { verifyGoogle } from './google';

// Google's token check is swapped for a fake here (server/google.test.ts
// checks the real one against signed tokens): these tests are about what
// happens once Google has vouched for an account.
vi.mock('./google', () => ({ verifyGoogle: vi.fn() }));

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
  for (const table of ['visitors', 'oauth_codes', 'oauth_clients', 'profile_listens', 'google_accounts', 'sessions', 'listen_daily', 'events_daily', 'visits', 'listeners', 'login_failures', 'logins', 'remote_commands', 'remote_state', 'uploads', 'passkeys', 'device_keys', 'profiles', 'challenges', 'defaults']) {
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

/**
 * A profile signed in with Google, made straight in the database for `key`
 * (signing in itself is tested in the /api/google block). Cloud features need
 * one: since Google became the way in, a save never creates a profile.
 */
const member = async (key: string, sub = `g-${key.slice(0, 8)}`, data = '{}') => {
  const keyHash = await hashKey(key);
  if (await env.DB.prepare('SELECT 1 AS x FROM device_keys WHERE key_hash = ?').bind(keyHash).first()) return;
  const id = crypto.randomUUID();
  const at = Date.now() - 5_000; // old enough that the first save isn't throttled
  await env.DB.batch([
    env.DB.prepare('INSERT INTO profiles (id, data, version, created_at) VALUES (?, ?, ?, ?)').bind(id, data, at, at),
    env.DB.prepare('INSERT INTO device_keys (key_hash, profile_id, created_at) VALUES (?, ?, ?)').bind(keyHash, id, at),
    env.DB.prepare('INSERT INTO google_accounts (sub, profile_id, email, created_at) VALUES (?, ?, ?, ?)').bind(
      sub,
      id,
      `${sub}@gmail.com`,
      at,
    ),
  ]);
};

/** A cloud copy from before Google sign-in: a key and a profile, no Google account. */
const legacy = async (key: string, data = '{"note":"old"}') => {
  const id = crypto.randomUUID();
  const at = Date.now() - 5_000;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO profiles (id, data, version, created_at) VALUES (?, ?, ?, ?)').bind(id, data, at, at),
    env.DB.prepare('INSERT INTO device_keys (key_hash, profile_id, created_at) VALUES (?, ?, ?)').bind(await hashKey(key), id, at),
  ]);
  return id;
};

/** Saves as a signed-in visitor (making the profile first if `key` is a fresh, well-formed one). */
const save = async (key: string, data: unknown = { app: 'vibe-mode', note: 'hi' }, extra = {}) => {
  if (/^[A-Za-z0-9_-]{43}$/.test(key)) await member(key);
  return call(profile.onRequestPut, api('/api/profile', { method: 'PUT', key, body: JSON.stringify({ data }) }), extra);
};

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
  it('saves, loads (with the account), updates and deletes', async () => {
    const key = newKey();
    expect((await save(key)).status).toBe(200);

    const loaded = await call(profile.onRequestGet, api('/api/profile', { key }));
    expect(loaded.headers.get('Cache-Control')).toBe('no-store');
    expect(await loaded.json()).toMatchObject({ data: { note: 'hi' }, uploads: {}, account: { email: expect.stringMatching(/@gmail\.com$/) } });

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
    await member(key);
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
    const before = await (await call(profile.onRequestGet, api('/api/profile', { key }))).json<{ version: number }>();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const removed = await call(
      uploads.onRequestDelete,
      api('/api/uploads/metro', { method: 'DELETE', key }),
      { params: { mode: 'metro' } },
    );
    expect(removed.status).toBe(200);
    // A picture change moves the version, so other devices pick it up.
    const { version } = await removed.json<{ version: number }>();
    expect(version).toBeGreaterThan(before.version);
    const body = await (await call(profile.onRequestGet, api('/api/profile', { key }))).json<{ uploads: object; version: number }>();
    expect(body.uploads).toEqual({});
    expect(body.version).toBe(version);
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

  it('lets in a Google account listed in ADMIN_EMAILS, and no other', async () => {
    const google = { env: { GOOGLE_CLIENT_ID: 'client-1', ADMIN_EMAILS: ' Owner@Gmail.com , other@x.com' } };
    const jwt = 'a.b.c';
    const as = (email: string | null) =>
      vi.mocked(verifyGoogle).mockResolvedValue({ sub: 's', email, name: null, picture: null });
    as('owner@gmail.com');
    // Google alone is a way in: no owner key needed.
    expect((await ask('', jwt, google)).status).toBe(200);
    expect(vi.mocked(verifyGoogle)).toHaveBeenLastCalledWith(jwt, 'client-1');
    as('stranger@gmail.com');
    expect((await ask('', jwt, google)).status).toBe(401);
    as(null); // an unverified email comes back as null
    expect((await ask('', jwt, google)).status).toBe(401);
    vi.mocked(verifyGoogle).mockResolvedValue(null); // expired or forged
    expect((await ask('', jwt, google)).status).toBe(401);
    // Without a client id the list means nothing; with no list, a Google token is refused even beside an owner key.
    expect((await ask('', jwt, { env: { ADMIN_EMAILS: 'owner@gmail.com' } })).status).toBe(503);
    as('owner@gmail.com');
    expect((await ask('', jwt, { env: { GOOGLE_CLIENT_ID: 'client-1', MCP_ADMIN_TOKEN: OWNER } })).status).toBe(401);
  });

  it('counts visitors, lists them newest change first, and finds one by Google email', async () => {
    const [a, b] = [newKey(), newKey()];
    await member(a, 'asha');
    await save(a, {
      customization: { edits: { metro: { name: 'Mine' } }, added: [{ id: 'my-1', baseId: 'metro' }], order: [] },
      customPlaylists: { metro: [{ id: 'p1' }, { id: 'p2' }], office: 'not a list' }, // odd shapes must not break it
    });
    await save(b, { note: 'b' });

    const body = await (await ask()).json<{
      totals: { visitors: number; google: number; devices: number };
      visitors: { google: string | null; added_modes: number; edited_modes: number; playlists: number; devices: number }[];
      more: boolean;
    }>();
    expect(body.totals).toMatchObject({ visitors: 2, google: 2, devices: 2 });
    expect(body.more).toBe(false);
    const asha = body.visitors.find((visitor) => visitor.google === 'asha@gmail.com')!;
    expect(asha).toMatchObject({ added_modes: 1, edited_modes: 1, playlists: 2, devices: 1 });

    const found = await (await ask('?q=ASHA@')).json<{ visitors: { google: string }[] }>();
    expect(found.visitors.map((visitor) => visitor.google)).toEqual(['asha@gmail.com']);
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

  it('keeps page speed once per visit, and counts a remembered browser once per day', async () => {
    const tab = newKey();
    const visitor = newKey();
    await beacon({ tab, openMs: 5_000, loadMs: 1840, lcpMs: 2210, visitor });
    await beacon({ tab, openMs: 9_000, loadMs: 9999, lcpMs: 9999, visitor }); // later reports don't rewrite the speed
    await beacon({ tab, openMs: 9_000, loadMs: 999_999 }); // a glitch, not a slow page
    const row = await env.DB.prepare('SELECT load_ms, lcp_ms FROM sessions WHERE tab = ?').bind(tab).first();
    expect(row).toEqual({ load_ms: 1840, lcp_ms: 2210 });
    // Same day, many reports: one day seen.
    expect(await env.DB.prepare('SELECT days FROM visitors WHERE id = ?').bind(visitor).first<number>('days')).toBe(1);
    // A report without the id (no consent) adds no visitor; a bad id is ignored.
    await beacon({ tab: newKey(), openMs: 1_000, visitor: 'not-an-id' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM visitors').first<number>('n')).toBe(1);
    // Seen again on a later day: a returning visitor.
    await env.DB.prepare("UPDATE visitors SET first_day = '2000-01-01', last_day = '2000-01-01'").run();
    await beacon({ tab: newKey(), openMs: 1_000, visitor });
    expect(await env.DB.prepare('SELECT days FROM visitors WHERE id = ?').bind(visitor).first<number>('days')).toBe(2);
  });

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

describe('/api/google — Continue with Google, the way into the cloud', () => {
  const CLIENT = { env: { GOOGLE_CLIENT_ID: 'client-1.apps.googleusercontent.com' } };
  const as = (sub: string, extra: object = {}) =>
    vi.mocked(verifyGoogle).mockResolvedValue({ sub, email: `${sub}@gmail.com`, name: sub.toUpperCase(), picture: null, ...extra });
  const signIn = (key?: string, data: object = { note: 'this browser' }) =>
    call(google.onRequestPost, api('/api/google', { method: 'POST', key, body: JSON.stringify({ credential: 't', data }) }), CLIENT);
  const load = async (key: string) => (await call(profile.onRequestGet, api('/api/profile', { key }))).json<{ data: unknown; account: unknown }>();

  it('says whether it is set up, and refuses sign-ins when it isn’t or Google didn’t vouch', async () => {
    expect(await (await call(google.onRequestGet, api('/api/google'), {})).json()).toEqual({ clientId: null, account: null });
    as('g1');
    expect((await call(google.onRequestPost, api('/api/google', { method: 'POST', body: '{"credential":"t"}' }))).status).toBe(503);
    vi.mocked(verifyGoogle).mockResolvedValue(null);
    expect((await signIn()).status).toBe(401);
  });

  it('a first sign-in makes the account from this browser’s modes; signing in elsewhere loads them', async () => {
    as('g1');
    const first = await signIn(undefined, { note: 'my modes' });
    expect(first.status).toBe(201);
    const made = await first.json<{ key: string; created: boolean; version: number; account: { email: string; name: string } }>();
    expect(made).toMatchObject({ created: true, account: { email: 'g1@gmail.com', name: 'G1' } });
    expect(made.version).toBeGreaterThan(0);
    expect(await load(made.key)).toMatchObject({ data: { note: 'my modes' }, account: { email: 'g1@gmail.com' } });

    const again = await (await signIn(undefined, { note: 'another browser' })).json<{ key: string; created?: boolean }>();
    expect(again.created).toBeUndefined(); // the existing account, not a new one
    expect(await load(again.key)).toMatchObject({ data: { note: 'my modes' } });
    expect(await (await signIn(again.key)).json()).toMatchObject({ same: true });
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first<number>('n')).toBe(1);
  });

  it('links a cloud copy from before Google, keeping its modes and key', async () => {
    const key = newKey();
    await legacy(key, '{"note":"kept"}');
    expect((await call(profile.onRequestGet, api('/api/profile', { key }))).status).toBe(403); // not signed in yet
    as('g2');
    expect(await (await signIn(key)).json()).toMatchObject({ linked: true, account: { email: 'g2@gmail.com' } });
    expect(await load(key)).toMatchObject({ data: { note: 'kept' } });
  });

  it('switching accounts retires this browser’s old key, and keeps the old account for its Google sign-in', async () => {
    as('g3');
    await signIn(); // makes g3's account
    const other = newKey();
    await member(other, 'g4');
    as('g3');
    const switched = await (await signIn(other)).json<{ key: string }>();
    expect(switched.key).not.toBe(other);
    expect((await call(profile.onRequestGet, api('/api/profile', { key: other }))).status).toBe(401); // retired
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM google_accounts WHERE sub = 'g4'").first<number>('n')).toBe(1);
  });

  it('keeps the name and picture current on each sign-in', async () => {
    as('g5', { picture: 'https://lh3.googleusercontent.com/a/one' });
    const { key } = await (await signIn()).json<{ key: string }>();
    as('g5', { name: 'New Name', picture: 'https://lh3.googleusercontent.com/a/two' });
    await signIn();
    expect(await load(key)).toMatchObject({ account: { name: 'New Name', picture: 'https://lh3.googleusercontent.com/a/two' } });
  });
});

describe('linked activity — per-account history for the admin page', () => {
  const OWNER = 'o'.repeat(40);
  const listenPing = (body: object) =>
    call(
      listen.onRequestPost,
      api('/api/listen', { method: 'POST', body: JSON.stringify(body), headers: { 'User-Agent': CHROME_ANDROID } }),
    );
  const report = (body: object) =>
    call(
      session.onRequestPost,
      api('/api/session', { method: 'POST', body: JSON.stringify(body), headers: { 'User-Agent': CHROME_ANDROID } }),
    );
  const detailOf = async () => {
    const headers = { Authorization: `Bearer ${OWNER}` };
    const extra = { env: { MCP_ADMIN_TOKEN: OWNER } };
    const { visitors } = await (await call(admin.onRequestGet, api('/api/admin', { headers }), extra)).json<{
      visitors: { id: string; last_visit: number | null; listened_ms: number }[];
    }>();
    const id = (await env.DB.prepare('SELECT profile_id FROM device_keys').first<string>('profile_id'))!;
    const row = visitors.find((visitor) => visitor.id === id)!;
    const detail = await (await call(admin.onRequestGet, api(`/api/admin?user=${id}`, { headers }), extra)).json<{
      activity: { visits: { visible_ms: number; events: { name: string; n: number }[] }[]; songs: { name: string; ms: number }[] };
    }>();
    return { row, activity: detail.activity };
  };

  it('saves a visit, its features and its listening to the account only when the report carries the key', async () => {
    const key = newKey();
    await save(key);
    const tab = newKey();

    // Linked: the key comes along.
    await report({ tab, key, openMs: 60_000, visibleMs: 50_000, events: [{ name: 'panel', detail: 'Customize', n: 1 }] });
    await report({ tab, key, openMs: 90_000, visibleMs: 80_000, events: [{ name: 'panel', detail: 'Customize', n: 2 }] });
    const song = { tab, key, mode: 'metro', modeName: 'Metro', playlist: 'metro-vibes', track: 'Song one', playing: true };
    await listenPing(song);
    await env.DB.prepare('UPDATE listeners SET seen_at = seen_at - 60000').run();
    await listenPing(song);

    // Anonymous: another tab, no key.
    await report({ tab: newKey(), openMs: 10_000, visibleMs: 10_000 });

    const { row, activity } = await detailOf();
    expect(row.last_visit).toBeGreaterThan(0);
    expect(row.listened_ms).toBeGreaterThanOrEqual(60_000);
    expect(activity.visits).toHaveLength(1); // the anonymous one isn't theirs
    expect(activity.visits[0]).toMatchObject({ visible_ms: 80_000, events: [{ name: 'panel', detail: 'Customize', n: 3 }] });
    expect(activity.songs).toEqual([expect.objectContaining({ name: 'Song one' })]);
    // The anonymous totals still count everything, linked or not.
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first<number>('n')).toBe(2);
  });

  it('a report without the key (linking switched off) unlinks the visit; an unknown key links nothing', async () => {
    const key = newKey();
    await save(key);
    const tab = newKey();
    await report({ tab, key, openMs: 5_000, visibleMs: 5_000 });
    await report({ tab, openMs: 6_000, visibleMs: 6_000 }); // switched off mid-visit
    expect(await env.DB.prepare('SELECT profile_id, events FROM sessions WHERE tab = ?').bind(tab).first()).toEqual({
      profile_id: null,
      events: null,
    });
    await report({ tab: newKey(), key: newKey(), openMs: 1_000 }); // a key nobody has
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE profile_id IS NOT NULL').first<number>('n')).toBe(0);
  });

  it('deleting the cloud copy deletes the listening history and unlinks the visits', async () => {
    const key = newKey();
    await save(key);
    const tab = newKey();
    await report({ tab, key, openMs: 5_000, visibleMs: 5_000, events: [{ name: 'skip', n: 1 }] });
    const song = { tab, key, mode: 'metro', track: 'Song one', playing: true };
    await listenPing(song);
    await env.DB.prepare('UPDATE listeners SET seen_at = seen_at - 60000').run();
    await listenPing(song);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM profile_listens').first<number>('n')).toBe(1);

    await call(profile.onRequestDelete, api('/api/profile', { method: 'DELETE', key }));
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM profile_listens').first<number>('n')).toBe(0);
    expect(await env.DB.prepare('SELECT profile_id, events FROM sessions').first()).toEqual({ profile_id: null, events: null });
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM listen_daily').first<number>('n')).toBe(1); // anonymous totals stay
  });
});

describe('audit fixes — saving, orphans, and races', () => {
  const put = (key: string, body: object) =>
    call(profile.onRequestPut, api('/api/profile', { method: 'PUT', key, body: JSON.stringify(body) }));

  it('a save never creates a profile: an unknown key gets 401, whatever it asks for', async () => {
    expect((await put(newKey(), { data: {}, create: true })).status).toBe(401);
    expect((await put(newKey(), { data: {} })).status).toBe(401);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first<number>('n')).toBe(0);
  });

  it('measures saved data in bytes, so text that is small in characters but big in UTF-8 is refused cleanly', async () => {
    const emoji = '\u{1F600}'.repeat(300_000); // 600k UTF-16 units, 1.2 MB of UTF-8
    const key = newKey();
    await member(key);
    expect((await put(key, { data: { note: emoji } })).status).toBe(413);
  });

  it('deletes the profile a browser leaves when signing in elsewhere, unless something else still reaches it', async () => {
    const CLIENT = { env: { GOOGLE_CLIENT_ID: 'client-1.apps.googleusercontent.com' } };
    const asAsha = () =>
      vi.mocked(verifyGoogle).mockResolvedValue({ sub: 'asha', email: 'asha@gmail.com', name: null, picture: null });
    await member(newKey(), 'asha'); // asha's account already exists

    // A copy from before Google, reached by nothing but this browser's key, signs in to asha:
    const lonely = newKey();
    await legacy(lonely);
    asAsha();
    const answer = await call(google.onRequestPost, api('/api/google', { method: 'POST', key: lonely, body: '{"credential":"t"}' }), CLIENT);
    expect(await answer.json()).toMatchObject({ key: expect.any(String) });
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first<number>('n')).toBe(1); // nothing could reach it any more

    const kept = newKey(); // signed in with its own Google account: it stays
    await member(kept, 'ravi');
    asAsha();
    await call(google.onRequestPost, api('/api/google', { method: 'POST', key: kept, body: '{"credential":"t"}' }), CLIENT);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first<number>('n')).toBe(2);
  });

  it('a listening ping still works after its account was deleted mid-play', async () => {
    const tab = newKey();
    await env.DB.prepare(
      `INSERT INTO listeners (tab, mode, playing, seen_at, profile_id) VALUES (?, 'metro', 1, ?, 'deleted-profile')`,
    )
      .bind(tab, Date.now() - 60_000)
      .run();
    const ping = await call(
      listen.onRequestPost,
      api('/api/listen', {
        method: 'POST',
        body: JSON.stringify({ tab, mode: 'metro', playing: true }),
        headers: { 'User-Agent': CHROME_ANDROID },
      }),
    );
    expect(ping.status).toBe(204);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM listen_daily').first<number>('n')).toBe(1); // anonymous minutes still count
  });

  it('an account whose email Google didn’t verify still counts as signed in', async () => {
    const CLIENT = { env: { GOOGLE_CLIENT_ID: 'client-1.apps.googleusercontent.com' } };
    vi.mocked(verifyGoogle).mockResolvedValue({ sub: 'no-email', email: null, name: null, picture: null });
    const made = await (
      await call(google.onRequestPost, api('/api/google', { method: 'POST', body: '{"credential":"t"}' }), CLIENT)
    ).json<{ key: string }>();
    const status = await (await call(google.onRequestGet, api('/api/google', { key: made.key }), CLIENT)).json();
    expect(status).toMatchObject({ account: { email: null } });
    expect((await call(profile.onRequestGet, api('/api/profile', { key: made.key }))).status).toBe(200);
  });
});

describe('signed in with Google — the gate on every cloud feature', () => {
  it('a cloud copy from before Google is kept, but its cloud features answer 403 until it signs in', async () => {
    const key = newKey();
    await legacy(key);
    const gated = [
      await call(profile.onRequestGet, api('/api/profile', { key })),
      await call(profile.onRequestPut, api('/api/profile', { method: 'PUT', key, body: '{"data":{}}' })),
      await call(uploads.onRequestPut, api('/api/uploads/metro', { method: 'PUT', key, body: still() }), { params: { mode: 'metro' } }),
      await call(keys.onRequestPost, api('/api/keys', { method: 'POST', key })),
      await call(remote.onRequestPost, api('/api/remote', { method: 'POST', key, body: '{}' })),
    ];
    for (const response of gated) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ google: true });
    }
    // Leaving and deleting are never gated.
    expect((await call(profile.onRequestDelete, api('/api/profile', { method: 'DELETE', key }))).status).toBe(204);
  });

  it('signing out this browser retires only its own key', async () => {
    const mine = newKey();
    await save(mine);
    const minted = await (await call(keys.onRequestPost, api('/api/keys', { method: 'POST', key: mine }))).json<{ key: string }>();
    expect((await call(keys.onRequestDelete, api('/api/keys?self', { method: 'DELETE', key: mine }))).status).toBe(204);
    expect((await call(profile.onRequestGet, api('/api/profile', { key: mine }))).status).toBe(401);
    expect((await call(profile.onRequestGet, api('/api/profile', { key: minted.key }))).status).toBe(200);
  });
});

describe('OAuth for the personal MCP server (/mcp)', () => {
  const CLIENT = { env: { GOOGLE_CLIENT_ID: 'client-1.apps.googleusercontent.com' } };
  const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
  const register = (body: object) =>
    call(oauthRegister.onRequestPost, api('/api/oauth/register', { method: 'POST', body: JSON.stringify(body) }));
  const verifier = 'v'.repeat(50);
  const approve = async (clientId: string, extra: object = {}) =>
    call(
      oauthAuthorize.onRequestPost,
      api('/api/oauth/authorize', {
        method: 'POST',
        body: JSON.stringify({
          credential: 't',
          client_id: clientId,
          redirect_uri: REDIRECT,
          code_challenge: await challengeOf(verifier),
          code_challenge_method: 'S256',
          state: 'xyz',
          ...extra,
        }),
      }),
      CLIENT,
    );
  const token = (fields: Record<string, string>) =>
    call(
      oauthToken.onRequestPost,
      api('/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
      }),
    );

  it('registers apps with safe return addresses only', async () => {
    expect((await register({ redirect_uris: ['javascript:alert(1)'] })).status).toBe(400);
    expect((await register({ redirect_uris: ['http://evil.example/cb'] })).status).toBe(400); // http only on localhost
    expect((await register({ redirect_uris: [] })).status).toBe(400);
    const ok = await register({ redirect_uris: [REDIRECT, 'http://localhost:6274/cb'], client_name: 'Claude' });
    expect(ok.status).toBe(201);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await ok.json()).toMatchObject({ client_name: 'Claude', token_endpoint_auth_method: 'none' });
  });

  it('runs the whole flow: approve with Google → code → token → MCP as that visitor', async () => {
    const { client_id } = await (await register({ redirect_uris: [REDIRECT], client_name: 'Claude' })).json<{ client_id: string }>();
    const lookup = (redirect: string) =>
      call(oauthClient.onRequestGet, api(`/api/oauth/client?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect)}`));
    expect(await (await lookup(REDIRECT)).json()).toEqual({ name: 'Claude' });
    expect((await lookup('https://evil.example/cb')).status).toBe(400); // never redirect to an unregistered address

    vi.mocked(verifyGoogle).mockResolvedValue({ sub: 'g-oauth', email: 'o@gmail.com', name: null, picture: null });
    const approved = await (await approve(client_id)).json<{ redirect: string }>();
    const back = new URL(approved.redirect);
    expect(back.origin + back.pathname).toBe(REDIRECT);
    expect(back.searchParams.get('state')).toBe('xyz');
    const code = back.searchParams.get('code')!;

    // Wrong verifier: refused, and the code is spent.
    expect((await token({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id, code_verifier: 'w'.repeat(50) })).status).toBe(400);
    const second = new URL((await (await approve(client_id)).json<{ redirect: string }>()).redirect).searchParams.get('code')!;
    const granted = await token({ grant_type: 'authorization_code', code: second, redirect_uri: REDIRECT, client_id, code_verifier: verifier });
    expect(granted.status).toBe(200);
    const { access_token } = await granted.json<{ access_token: string; token_type: string }>();
    // Used once.
    expect((await token({ grant_type: 'authorization_code', code: second, redirect_uri: REDIRECT, client_id, code_verifier: verifier })).status).toBe(400);

    // The token works at /mcp as a Bearer, for the visitor's own profile.
    const init = await call(
      mcp.onRequest,
      api('/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } }),
      }),
      { params: {} },
    );
    expect(init.status).toBe(200);

    // …and nowhere else: the assistant's token is scoped to /mcp, so it can't
    // read the profile, delete it, or sign the visitor's own devices out.
    const asAssistant = { key: access_token };
    expect((await call(profile.onRequestGet, api('/api/profile', asAssistant))).status).toBe(401);
    expect((await call(profile.onRequestDelete, api('/api/profile', { method: 'DELETE', ...asAssistant }))).status).toBe(401);
    expect((await call(keys.onRequestDelete, api('/api/keys', { method: 'DELETE', ...asAssistant }))).status).toBe(401);
  });

  it('without a token, /mcp says where to sign in', async () => {
    const response = await call(mcp.onRequest, api('/mcp', { method: 'POST', body: '{}' }), { params: {} });
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe(
      'Bearer resource_metadata="https://vibe-mode.pages.dev/.well-known/oauth-protected-resource"',
    );
  });

  it('refuses an approval without PKCE, or for an app that isn’t registered', async () => {
    const { client_id } = await (await register({ redirect_uris: [REDIRECT] })).json<{ client_id: string }>();
    vi.mocked(verifyGoogle).mockResolvedValue({ sub: 'g-x', email: null, name: null, picture: null });
    expect((await approve(client_id, { code_challenge_method: 'plain' })).status).toBe(400);
    expect((await approve('nobody')).status).toBe(400);
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
