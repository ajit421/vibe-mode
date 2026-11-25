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
}
let server: {
  profiles: Map<string, Stored>;
  calls: string[];
  queued: { action: string; value: string | null }[];
  reported: unknown[];
};

function fakeApi() {
  server = { profiles: new Map(), calls: [], queued: [], reported: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), location.href);
      const method = init.method ?? 'GET';
      server.calls.push(`${method} ${url.pathname}`);
      const key = new Headers(init.headers).get('Authorization')?.slice(7) ?? '';
      const found = server.profiles.get(key);
      if (url.pathname === '/api/config') return Response.json({ playlists: {}, images: {}, posters: {} });
      if (url.pathname === '/api/profile' && method === 'GET') {
        return found ? Response.json(found) : Response.json({ error: 'Unknown key.' }, { status: 401 });
      }
      if (url.pathname === '/api/profile' && method === 'PUT') {
        const { data } = JSON.parse(String(init.body));
        const version = (found?.version ?? 0) + 1;
        server.profiles.set(key, { data, uploads: found?.uploads ?? {}, version });
        return Response.json({ version }, { status: found ? 200 : 201 });
      }
      if (url.pathname === '/api/remote' && found) {
        const { state } = JSON.parse(String(init.body));
        if (state) server.reported.push(state);
        const commands = server.queued.splice(0);
        return Response.json({ commands, version: found.version });
      }
      if (url.pathname === '/api/login' && method === 'POST') {
        const { username, password } = JSON.parse(String(init.body));
        return username === 'asha' && password === 'long enough pw'
          ? Response.json({ key: KEY })
          : Response.json({ error: 'Wrong username or password.' }, { status: 401 });
      }
      if (url.pathname === '/api/profile' && method === 'DELETE') {
        server.profiles.delete(key);
        return new Response(null, { status: 204 });
      }
      if (url.pathname.startsWith('/api/uploads/') && found) {
        const mode = url.pathname.split('/').pop()!;
        if (method === 'PUT') found.uploads[mode] = String(init.body);
        else delete found.uploads[mode];
        return Response.json({ ok: true });
      }
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }),
  );
}

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

describe('cloud save', () => {
  it('sends nothing for a visitor who changed nothing', async () => {
    ({ unmount } = mountProviders());
    await settle(5000);
    expect(server.calls.filter((c) => c.includes('/api/profile'))).toEqual([]);
    expect(record()?.key ?? null).toBeNull();
  });

  it('saves a change two seconds later, under a new key', async () => {
    ({ unmount } = mountProviders());
    await settle();
    act(() => ctx.vibe!.editMode('metro', { name: 'My Metro' }));
    await settle(1000);
    expect(server.calls).not.toContain('PUT /api/profile');
    await settle(1500);
    expect(server.calls).toContain('PUT /api/profile');
    const key = record().key!;
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const saved = server.profiles.get(key)!.data as { customization: { edits: Record<string, { name: string }> } };
    expect(saved.customization.edits.metro.name).toBe('My Metro');
    expect(ctx.sync!.status).toBe('saved');
  });

  it('sends a picture once, and deletes it from the cloud when removed', async () => {
    ({ unmount } = mountProviders());
    await settle();
    act(() => void ctx.vibe!.setUpload('metro', still(500)));
    await settle(2500);
    const key = record().key!;
    expect(server.profiles.get(key)!.uploads.metro).toBe(still(500));
    expect(server.calls.filter((c) => c === 'PUT /api/uploads/metro')).toHaveLength(1);

    act(() => ctx.vibe!.editMode('metro', { image: null }));
    await settle(2500);
    expect(server.profiles.get(key)!.uploads.metro).toBeUndefined();
  });

  it('a sync link on a fresh browser loads that profile and leaves the address bar', async () => {
    server.profiles.set(KEY, {
      data: { customization: { edits: { metro: { name: 'From my phone' } }, added: [], order: [] } },
      uploads: {},
      version: 7,
    });
    history.replaceState(null, '', `/#sync=${KEY}`);
    ({ unmount } = mountProviders());
    await settle(100);
    expect(location.hash).toBe('');
    expect(ctx.vibe!.allThemes.find((t) => t.id === 'metro')!.name).toBe('From my phone');
    expect(record().key).toBe(KEY);
  });

  it('a username and password load that profile; a wrong one changes nothing and isn’t a failed save', async () => {
    server.profiles.set(KEY, {
      data: { customization: { edits: { metro: { name: 'From my account' } }, added: [], order: [] } },
      uploads: {},
      version: 3,
    });
    ({ unmount } = mountProviders());
    await settle();

    let ok = true;
    await act(async () => void (ok = await ctx.sync!.signInWithPassword('asha', 'nope nope nope')));
    expect(ok).toBe(false);
    expect(ctx.sync!.message).toBe('Wrong username or password.');
    expect(ctx.sync!.status).not.toBe('error');
    expect(ctx.vibe!.allThemes.find((t) => t.id === 'metro')!.name).not.toBe('From my account');

    await act(async () => void (ok = await ctx.sync!.signInWithPassword('asha', 'long enough pw')));
    expect(ok).toBe(true);
    expect(ctx.vibe!.allThemes.find((t) => t.id === 'metro')!.name).toBe('From my account');
    expect(record().key).toBe(KEY);
  });

  it('a browser signed out elsewhere forgets its key but keeps its modes', async () => {
    ({ unmount } = mountProviders());
    await settle();
    act(() => ctx.vibe!.editMode('metro', { name: 'Local' }));
    const data = splitBackup(ctx.vibe!.exportSettings()).data;
    localStorage.setItem(
      SYNC_STORAGE_KEY,
      JSON.stringify({ key: KEY, data: fingerprint(JSON.stringify(data)), uploads: {}, version: 1, off: false }),
    );
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(record().key).toBeNull();
    expect(ctx.vibe!.allThemes.find((t) => t.id === 'metro')!.name).toBe('Local');
  });

  it('"Delete my cloud copy" turns saving off until turned back on', async () => {
    ({ unmount } = mountProviders());
    await settle();
    act(() => ctx.vibe!.editMode('metro', { name: 'A' }));
    await settle(2500);
    await act(async () => void (await ctx.sync!.deleteCloudCopy()));
    expect(record()).toMatchObject({ key: null, off: true });
    const before = server.calls.length;
    act(() => ctx.vibe!.editMode('metro', { name: 'B' }));
    await settle(2500);
    expect(server.calls.slice(before).filter((c) => c.startsWith('PUT'))).toEqual([]);
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
    act(() => ctx.vibe!.editMode('metro', { name: 'M' })); // gives this browser a cloud copy
    act(() => ctx.vibe!.selectTheme('metro'));
    await settle(2500);
    expect(server.calls).not.toContain('POST /api/remote'); // off until switched on

    act(() => ctx.sync!.setRemoteControl(true));
    await settle();
    expect(server.reported[server.reported.length - 1]).toMatchObject({ mode: 'metro', modeName: 'M' });

    server.queued.push({ action: 'switch_mode', value: 'office' }, { action: 'set_volume', value: '30' });
    await settle(5000); // the next poll (4s) plus the mode-change wipe (380ms)
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
