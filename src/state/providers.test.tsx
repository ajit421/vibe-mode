// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableJavaScriptFileLoading":true,"handleDisabledFileLoadingAsSuccess":true}}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyMotion, domAnimation } from 'motion/react';
import { act, mount } from '@/test/render';
import App from '@/App';
import { VibeProvider } from './VibeProvider';
import { ToastProvider } from './ToastProvider';
import { SyncProvider } from './SyncProvider';
import { PlayerProvider } from './PlayerProvider';
import { usePlayer, type PlayerContextValue } from './player-context';
import { RemoteControl } from '@/components/RemoteControl';
import { useVibe, type VibeContextValue } from './vibe-context';
import { useSync, type SyncContextValue } from './sync-context';
import { SYNC_STORAGE_KEY, fingerprint, splitBackup } from '@/sync/sync';
import { STORAGE_KEYS } from '@/utils/storage';

/*
 * The real providers, wired as in App.tsx, against an in-memory stand-in for
 * functions/api/ (whose real behaviour is covered in server/api.test.ts).
 */

const KEY = 'K'.repeat(43);
const still = (size: number) => `data:image/webp;base64,${'A'.repeat(size)}`;

interface Stored {
  data: Record<string, unknown>;
  uploads: Record<string, string>;
  version: number;
  /** Signed in with Google; null = a cloud copy from before Google (403 on cloud features). */
  account: { email: string; name: string; picture: null } | null;
}
let server: {
  /** Device key → profile (several keys may share one profile). */
  profiles: Map<string, Stored>;
  /** Google account (the fake credential is its id) → profile. */
  accounts: Map<string, Stored>;
  calls: string[];
  queued: { action: string; value: string | null }[];
  reported: unknown[];
};

const accountFor = (sub: string) => ({ email: `${sub}@gmail.com`, name: sub.toUpperCase(), picture: null });
let minted = 0;
/** Keys the fake server hands out: well-formed, and different each time. */
const freshKey = () => `${'F'.repeat(40)}${String((minted += 1)).padStart(3, '0')}`;

/**
 * An in-memory stand-in for functions/api/ with the same rules: cloud features
 * need a profile signed in with Google; Google sign-in makes, links or opens
 * one (functions/api/google.ts). The real rules are tested in server/api.test.ts.
 */
function fakeApi() {
  server = { profiles: new Map(), accounts: new Map(), calls: [], queued: [], reported: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), location.href);
      const method = init.method ?? 'GET';
      server.calls.push(`${method} ${url.pathname}`);
      const key = new Headers(init.headers).get('Authorization')?.slice(7) ?? '';
      const found = server.profiles.get(key);
      const gate = () =>
        !found
          ? Response.json({ error: 'Unknown key.' }, { status: 401 })
          : !found.account
            ? Response.json({ error: 'Sign in with Google.', google: true }, { status: 403 })
            : null;
      if (url.pathname === '/api/config') return Response.json({ playlists: {}, images: {}, posters: {} });
      if (url.pathname === '/api/google' && method === 'GET') {
        return Response.json({ clientId: 'test-client', account: found?.account ?? null });
      }
      if (url.pathname === '/api/google' && method === 'POST') {
        const { credential, data } = JSON.parse(String(init.body));
        const account = accountFor(credential);
        const existing = server.accounts.get(credential);
        if (existing) {
          if (found === existing) return Response.json({ same: true, account });
          const next = freshKey();
          server.profiles.set(next, existing);
          server.profiles.delete(key);
          return Response.json({ key: next, account });
        }
        if (found && !found.account) {
          found.account = account;
          server.accounts.set(credential, found);
          return Response.json({ linked: true, account }, { status: 201 });
        }
        const made: Stored = { data: data ?? {}, uploads: {}, version: 1, account };
        const next = freshKey();
        server.accounts.set(credential, made);
        server.profiles.set(next, made);
        server.profiles.delete(key);
        return Response.json({ key: next, account, created: true, version: 1 }, { status: 201 });
      }
      if (url.pathname === '/api/profile' && method === 'GET') return gate() ?? Response.json(found);
      if (url.pathname === '/api/profile' && method === 'PUT') {
        const refused = gate();
        if (refused) return refused;
        found!.data = JSON.parse(String(init.body)).data;
        found!.version += 1;
        return Response.json({ version: found!.version });
      }
      if (url.pathname === '/api/profile' && method === 'DELETE') {
        if (found) for (const [k, v] of server.profiles) if (v === found) server.profiles.delete(k);
        return new Response(null, { status: 204 });
      }
      if (url.pathname === '/api/keys' && method === 'DELETE' && url.search === '?self') {
        server.profiles.delete(key);
        return new Response(null, { status: 204 });
      }
      if (url.pathname === '/api/remote') {
        const refused = gate();
        if (refused) return refused;
        const { state } = JSON.parse(String(init.body));
        if (state) server.reported.push(state);
        const commands = server.queued.splice(0);
        return Response.json({ commands, version: found!.version });
      }
      if (url.pathname.startsWith('/api/uploads/')) {
        const refused = gate();
        if (refused) return refused;
        const mode = url.pathname.split('/').pop()!;
        if (method === 'PUT') found!.uploads[mode] = String(init.body);
        else delete found!.uploads[mode];
        return Response.json({ ok: true });
      }
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }),
  );
}

/** Signs this browser in with the fake Google account `sub`. */
const signIn = (sub = 'asha') => act(async () => void (await ctx.sync!.continueWithGoogle(sub)));

const ctx: { vibe?: VibeContextValue; sync?: SyncContextValue; player?: PlayerContextValue } = {};
function Probe() {
  ctx.vibe = useVibe();
  ctx.sync = useSync();
  return null;
}
function PlayerProbe() {
  ctx.player = usePlayer();
  return null;
}
const mountProviders = () =>
  mount(
    <LazyMotion features={domAnimation}>
      <VibeProvider>
        <ToastProvider>
          <SyncProvider>
            <Probe />
          </SyncProvider>
        </ToastProvider>
      </VibeProvider>
    </LazyMotion>,
  );

/** Lets fetches resolve and timers run, inside act so effects flush. */
const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const stored = <T,>(key: string): T => JSON.parse(localStorage.getItem(key) ?? 'null');
const record = () => stored<{ key: string | null; off: boolean }>(SYNC_STORAGE_KEY);

// happy-dom's Web Animations reject when a toast unmounts mid-fade, which
// real browsers' don't surface; without it, motion animates in plain JS.
delete (Element.prototype as Partial<Element>).animate;

let unmount: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/');
  vi.useFakeTimers();
  fakeApi();
});
afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('the whole app', () => {
  it('starts on the landing screen without crashing', async () => {
    ({ unmount } = mount(<App />));
    await settle(100);
    expect(document.body.textContent).toContain('Where are you');
    expect(document.body.textContent).not.toContain('Something broke');
  });
});

describe('customising modes', () => {
  it('a copy keeps the uploaded picture and the listener’s own playlists', async () => {
    ({ unmount } = mountProviders());
    await settle();
    act(() => void ctx.vibe!.setUpload('metro', still(100)));
    act(() => void ctx.vibe!.addCustomPlaylist('Mine', 'PL1234567890abcdef', 'metro'));
    let copy: string | null = null;
    act(() => void (copy = ctx.vibe!.addMode('metro')));

    const uploads = stored<Record<string, string>>(STORAGE_KEYS.uploads);
    expect(uploads[copy!]).toBe(still(100));
    const own = stored<Record<string, { id: string; name: string }[]>>(STORAGE_KEYS.customPlaylists);
    expect(own[copy!]).toHaveLength(1);
    expect(own[copy!][0].name).toBe('Mine');
    expect(own[copy!][0].id).not.toBe(own.metro[0].id);
  });

  it('a shared mode whose picture doesn’t fit is added without it, and says so', async () => {
    ({ unmount } = mountProviders());
    await settle();
    act(() => void ctx.vibe!.setUpload('metro', still(1_400_000)));
    act(() => void ctx.vibe!.setUpload('office', still(1_400_000)));
    const shared = { app: 'vibe-mode', kind: 'mode', baseId: 'metro', edit: { name: 'Shared', image: 'upload' }, playlists: [], upload: still(1_000_000) };
    let result: ReturnType<VibeContextValue['importSettings']> = null;
    act(() => void (result = ctx.vibe!.importSettings(shared)));
    expect(result).toMatchObject({ kind: 'mode', pictureDropped: true });
    expect(stored<Record<string, string>>(STORAGE_KEYS.uploads)[(result as unknown as { id: string }).id]).toBeUndefined();
  });

  it('refuses to hide or delete the last visible mode', async () => {
    ({ unmount } = mountProviders());
    await settle();
    const ids = ctx.vibe!.themes.map((t) => t.id);
    for (const id of ids) act(() => ctx.vibe!.editMode(id, { hidden: true }));
    expect(ctx.vibe!.themes).toHaveLength(1);
  });
});

describe('cloud save — a signed-in (Google) feature', () => {
  it('sends nothing for a visitor who changed nothing', async () => {
    ({ unmount } = mountProviders());
    await settle(5000);
    expect(server.calls.filter((c) => c.includes('/api/profile'))).toEqual([]);
    expect(record()?.key ?? null).toBeNull();
    expect(ctx.sync!.status).toBe('signed-out');
  });

  it('not signed in, changes stay in this browser; the first sign-in makes the account from them', async () => {
    ({ unmount } = mountProviders());
    await settle();
    act(() => ctx.vibe!.editMode('metro', { name: 'My Metro' }));
    await settle(5000);
    expect(server.calls.filter((c) => c.includes('/api/profile'))).toEqual([]); // nothing left the browser

    await signIn('asha');
    await settle(100);
    expect(ctx.sync!.account).toMatchObject({ email: 'asha@gmail.com' });
    const saved = server.accounts.get('asha')!.data as { customization: { edits: Record<string, { name: string }> } };
    expect(saved.customization.edits.metro.name).toBe('My Metro');

    // From now on, changes are saved two seconds later.
    act(() => ctx.vibe!.editMode('metro', { name: 'Later' }));
    await settle(1000);
    expect(server.calls).not.toContain('PUT /api/profile');
    await settle(1500);
    expect(server.calls).toContain('PUT /api/profile');
    expect(ctx.sync!.status).toBe('saved');
  });

  it('sends a picture once, and deletes it from the cloud when removed', async () => {
    ({ unmount } = mountProviders());
    await settle();
    await signIn();
    act(() => void ctx.vibe!.setUpload('metro', still(500)));
    await settle(2500);
    const stored = server.accounts.get('asha')!;
    expect(stored.uploads.metro).toBe(still(500));
    expect(server.calls.filter((c) => c === 'PUT /api/uploads/metro')).toHaveLength(1);

    act(() => ctx.vibe!.editMode('metro', { image: null }));
    await settle(2500);
    expect(stored.uploads.metro).toBeUndefined();
  });

  it('signing in to an account that already has modes asks which to keep', async () => {
    const mine: Stored = {
      data: { customization: { edits: { metro: { name: 'From my account' } }, added: [], order: [] } },
      uploads: {},
      version: 3,
      account: accountFor('asha'),
    };
    server.accounts.set('asha', mine);
    ({ unmount } = mountProviders());
    await settle();
    act(() => ctx.vibe!.editMode('metro', { name: 'This browser' }));
    await signIn('asha');
    // The dialog: load the account's modes.
    const load = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Load my account’s'))!;
    await act(async () => {
      load.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    await settle(100);
    expect(ctx.vibe!.allThemes.find((t) => t.id === 'metro')!.name).toBe('From my account');
    expect(ctx.sync!.account).toMatchObject({ email: 'asha@gmail.com' });
  });

  it('a cloud copy from before Google is kept and asks to sign in; signing in links it', async () => {
    server.profiles.set(KEY, { data: { note: 'old' }, uploads: {}, version: 2, account: null });
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({ key: KEY, data: null, uploads: {}, version: 2, off: false }));
    ({ unmount } = mountProviders());
    await settle(100);
    expect(ctx.sync!.status).toBe('needs-google');
    expect(record().key).toBe(KEY); // kept

    await signIn('ravi');
    await settle(100);
    expect(ctx.sync!.account).toMatchObject({ email: 'ravi@gmail.com' });
    expect(server.profiles.get(KEY)!.account).not.toBeNull();
  });

  it('a sync link on a fresh browser signs it in and leaves the address bar', async () => {
    server.profiles.set(KEY, {
      data: { customization: { edits: { metro: { name: 'From my phone' } }, added: [], order: [] } },
      uploads: {},
      version: 7,
      account: accountFor('asha'),
    });
    history.replaceState(null, '', `/#sync=${KEY}`);
    ({ unmount } = mountProviders());
    await settle(100);
    expect(location.hash).toBe('');
    expect(ctx.vibe!.allThemes.find((t) => t.id === 'metro')!.name).toBe('From my phone');
    expect(record().key).toBe(KEY);
    expect(ctx.sync!.account).toMatchObject({ email: 'asha@gmail.com' });
  });

  it('a browser signed out elsewhere forgets its key but keeps its modes', async () => {
    ({ unmount } = mountProviders());
    await settle();
    act(() => ctx.vibe!.editMode('metro', { name: 'Local' }));
    const data = splitBackup(ctx.vibe!.exportSettings()).data;
    localStorage.setItem(
      SYNC_STORAGE_KEY,
      JSON.stringify({ key: KEY, account: accountFor('asha'), data: fingerprint(JSON.stringify(data)), uploads: {}, version: 1, off: false }),
    );
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(record().key).toBeNull();
    expect(ctx.vibe!.allThemes.find((t) => t.id === 'metro')!.name).toBe('Local');
  });

  it('signing out keeps this browser’s modes and stops saving; so does deleting the cloud copy', async () => {
    ({ unmount } = mountProviders());
    await settle();
    await signIn();
    act(() => ctx.vibe!.editMode('metro', { name: 'A' }));
    await settle(2500);
    await act(async () => void (await ctx.sync!.signOut()));
    expect(record().key).toBeNull();
    expect(ctx.sync!.status).toBe('signed-out');
    expect(ctx.vibe!.allThemes.find((t) => t.id === 'metro')!.name).toBe('A');
    const before = server.calls.length;
    act(() => ctx.vibe!.editMode('metro', { name: 'B' }));
    await settle(2500);
    expect(server.calls.slice(before).filter((c) => c.startsWith('PUT'))).toEqual([]);

    // A new account (made from this browser's modes), then deleted: gone from the server.
    await signIn('ravi');
    await act(async () => void (await ctx.sync!.deleteCloudCopy()));
    expect([...server.profiles.values()].includes(server.accounts.get('ravi')!)).toBe(false);
    expect(record().key).toBeNull();
    expect(ctx.vibe!.allThemes.find((t) => t.id === 'metro')!.name).toBe('B');
  });
});

describe('audit fixes — cloud save', () => {
  it('a browser signed out from another device is told so, instead of quietly starting a second copy', async () => {
    ({ unmount } = mountProviders());
    await settle();
    // Signed in once, but the server no longer knows the key.
    localStorage.setItem(
      SYNC_STORAGE_KEY,
      JSON.stringify({ key: KEY, account: accountFor('asha'), data: 'stale', uploads: {}, version: 5, off: false }),
    );
    act(() => ctx.vibe!.editMode('metro', { name: 'Edited after sign-out' }));
    await settle(2500);
    expect(server.profiles.size).toBe(0); // nothing new was created
    expect(record().key).toBeNull();
    expect(ctx.sync!.message).toMatch(/signed out/);
  });

  it('"Reset everything" leaves the cloud copy alone for the other devices', async () => {
    ({ unmount } = mountProviders());
    await settle();
    await signIn();
    act(() => ctx.vibe!.editMode('metro', { name: 'Keep me' }));
    await settle(2500);
    const before = JSON.stringify(server.accounts.get('asha')!.data);
    act(() => {
      ctx.sync!.leaveCloud();
      ctx.vibe!.resetEverything();
    });
    await settle(2500);
    expect(JSON.stringify(server.accounts.get('asha')!.data)).toBe(before); // not overwritten with the emptied browser
    expect(record().key).toBeNull();
  });
});

describe('an AI assistant driving the player', () => {
  it('a tab that allows it reports what is playing and runs queued commands', async () => {
    ({ unmount } = mount(
      <LazyMotion features={domAnimation}>
        <VibeProvider>
          <ToastProvider>
            <SyncProvider>
              <PlayerProvider>
                <Probe />
                <PlayerProbe />
                <RemoteControl />
              </PlayerProvider>
            </SyncProvider>
          </ToastProvider>
        </VibeProvider>
      </LazyMotion>,
    ));
    await settle();
    await signIn(); // AI control of a tab is a signed-in feature
    act(() => ctx.vibe!.editMode('metro', { name: 'M' }));
    act(() => ctx.vibe!.selectTheme('metro'));
    await settle(2500);
    expect(server.calls).not.toContain('POST /api/remote'); // off until switched on

    act(() => ctx.sync!.setRemoteControl(true));
    await settle();
    expect(server.reported[server.reported.length - 1]).toMatchObject({ mode: 'metro', modeName: 'M' });

    server.queued.push({ action: 'switch_mode', value: 'office' }, { action: 'set_volume', value: '30' });
    // The next poll (4s), then the volume only once the mode switch has landed.
    // RemoteControl waits for that (up to 2s); in a browser it lands in ~0.4s,
    // but Preact's test `act` holds re-renders until it ends, so here the wait
    // runs to its cap.
    await settle(7000);
    expect(ctx.vibe!.theme.id).toBe('office');
    expect(ctx.player!.volume).toBe(30);

    server.queued.push({ action: 'switch_mode', value: 'atlantis' }); // unknown: ignored, nothing breaks
    await settle(5000);
    expect(ctx.vibe!.theme.id).toBe('office');

    act(() => ctx.sync!.setRemoteControl(false));
    const before = server.calls.length;
    await settle(10_000);
    expect(server.calls.slice(before)).not.toContain('POST /api/remote');
  });
});
