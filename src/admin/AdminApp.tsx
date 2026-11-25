import { useCallback, useEffect, useState, type ReactNode } from 'react';

/*
 * The owner's view of every visitor, over functions/api/admin.ts (read-only).
 *
 * The owner key (MCP_ADMIN_TOKEN) is typed in once and kept in sessionStorage,
 * so it is gone when the tab closes and never sits in localStorage. Nothing
 * refreshes on a timer: every call is a billed request, so "Refresh" is a button.
 * Everything shown is visitor-written text, rendered as text — never as HTML.
 */

const TOKEN_KEY = 'vibe-mode.adminToken';

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Storage blocked: the key lasts until the page reloads. */
  }
}

type Result<T> = { ok: true; body: T } | { ok: false; status: number; error: string };

/** Wrong key (401), or no owner key set up on the site (503): back to the key form, with the reason. */
const keyProblem = (status: number) => status === 401 || status === 503;

async function get<T>(token: string, query: string): Promise<Result<T>> {
  try {
    const response = await fetch(`/api/admin${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    // Only JSON is an answer: without Functions (plain `vite`), unknown paths get index.html.
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await response.json() : null;
    if (response.ok && isJson) return { ok: true, body: body as T };
    return {
      ok: false,
      status: response.status,
      error: typeof body?.error === 'string' ? body.error : 'The admin API didn’t answer. Is the latest version deployed?',
    };
  } catch {
    return { ok: false, status: 0, error: 'You seem to be offline.' };
  }
}

/* ── Shapes from functions/api/admin.ts ─────────────────────────────────── */

interface Totals {
  visitors: number;
  new_day: number;
  new_week: number;
  active_day: number;
  active_week: number;
  devices: number;
  passkeys: number;
  logins: number;
  uploads: number;
  upload_bytes: number;
  data_bytes: number;
  listening: number;
  queued_commands: number;
}

interface Visitor {
  id: string;
  username: string | null;
  created_at: number;
  version: number;
  data_bytes: number;
  added_modes: number;
  edited_modes: number;
  playlists: number;
  devices: number;
  passkeys: number;
  uploads: number;
  seen_at: number | null;
}

/** What a tab with "Let AI control this tab" on reports (RemoteControl.tsx). */
interface NowPlaying {
  modeName?: string;
  playlistName?: string | null;
  track?: string | null;
  artist?: string | null;
  playing?: boolean;
  volume?: number;
  muted?: boolean;
}

interface Overview {
  now: number;
  totals: Totals;
  visitors: Visitor[];
  more: boolean;
  listening: { profile_id: string; username: string | null; state: NowPlaying; seen_at: number }[];
  lockouts: { username: string; count: number; since: number }[];
  defaults: { kind: string; id: string; value: string }[];
}

interface Detail {
  now: number;
  id: string;
  created_at: number;
  version: number;
  data: unknown;
  login: { username: string; created_at: number } | null;
  devices: number[];
  passkeys: { credential_id: string; transports: unknown; created_at: number }[];
  uploads: { mode_id: string; still: string }[];
  remote: { state: NowPlaying; seen_at: number } | null;
  commands: { action: string; value: string | null; created_at: number }[];
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Infinity],
];

function ago(ms: number, now: number): string {
  let value = (ms - now) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit);
    value /= size;
  }
  return '';
}

function Time({ ms, now }: { ms: number | null; now: number }) {
  if (!ms) return <span className="text-zinc-500">—</span>;
  return (
    <time dateTime={new Date(ms).toISOString()} title={new Date(ms).toLocaleString()}>
      {ago(ms, now)}
    </time>
  );
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const shortId = (id: string) => id.slice(0, 8);

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const BUTTON =
  'rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:border-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500 disabled:opacity-40';
const INPUT =
  'w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500';

function Section({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-50 tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

/** A table that scrolls sideways on its own on a narrow screen, not the page. */
function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-900 text-xs text-zinc-400">
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">{children}</tbody>
      </table>
      {empty && <p className="px-3 py-4 text-sm text-zinc-500">{empty}</p>}
    </div>
  );
}

const TD = 'px-3 py-2 whitespace-nowrap tabular-nums';

function Track({ state }: { state: NowPlaying }) {
  return (
    <>
      {state.playing ? '▶ ' : '⏸ '}
      {state.track ?? <span className="text-zinc-500">nothing loaded</span>}
      {state.artist && <span className="text-zinc-500"> · {state.artist}</span>}
    </>
  );
}

/* ── Screens ────────────────────────────────────────────────────────────── */

export function AdminApp() {
  const [token, setToken] = useState(readToken);
  const [notice, setNotice] = useState<string | null>(null);
  const signOut = useCallback((reason?: string) => {
    writeToken(null);
    setToken(null);
    setNotice(reason ?? null);
  }, []);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6">
      {token ? (
        <Dashboard token={token} onSignOut={signOut} />
      ) : (
        <SignIn
          notice={notice}
          onToken={(value) => {
            writeToken(value);
            setToken(value);
          }}
        />
      )}
    </main>
  );
}

function SignIn({ notice, onToken }: { notice: string | null; onToken: (token: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="mx-auto mt-16 flex w-full max-w-sm flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) onToken(value.trim());
      }}
    >
      <h1 className="text-xl font-semibold text-zinc-50">Vibe Mode admin</h1>
      <p className="text-sm text-zinc-400">
        Enter the owner key — the <code className="text-zinc-300">MCP_ADMIN_TOKEN</code> secret of the Pages
        project. It stays in this tab only.
      </p>
      {/* A hidden username lets a password manager save the key under a name. */}
      <input type="text" name="username" autoComplete="username" value="owner" readOnly hidden />
      <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
        Owner key
        <input
          className={INPUT}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      </label>
      {notice && (
        <p role="alert" className="text-sm text-amber-400">
          {notice}
        </p>
      )}
      <button type="submit" className={BUTTON}>
        Open the admin panel
      </button>
    </form>
  );
}

function Dashboard({ token, onSignOut }: { token: string; onSignOut: (reason?: string) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(
    async (q: string, offset = 0) => {
      setLoading(true);
      const result = await get<Overview>(token, `?q=${encodeURIComponent(q)}&offset=${offset}`);
      setLoading(false);
      if (!result.ok) {
        if (keyProblem(result.status)) onSignOut(result.error);
        else setError(result.error);
        return;
      }
      setError(null);
      setSearched(q);
      setData((previous) => {
        if (!offset || !previous) return result.body;
        // The list is ordered by last change, so a visitor who saved since the
        // first page moves up and can turn up again further down: skip repeats.
        const shown = new Set(previous.visitors.map((visitor) => visitor.id));
        return { ...result.body, visitors: [...previous.visitors, ...result.body.visitors.filter((v) => !shown.has(v.id))] };
      });
    },
    [token, onSignOut],
  );

  useEffect(() => {
    void load('');
  }, [load]);

  if (selected) {
    return <VisitorDetail token={token} id={selected} onBack={() => setSelected(null)} onSignOut={onSignOut} />;
  }

  const t = data?.totals;
  const now = data?.now ?? Date.now();
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-50">Vibe Mode admin</h1>
          <p className="text-sm text-zinc-400" role="status">
            {loading ? 'Loading…' : data ? <>Updated <Time ms={data.now} now={Date.now()} /></> : ' '}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={BUTTON} disabled={loading} onClick={() => void load(searched)}>
            Refresh
          </button>
          <button type="button" className={BUTTON} onClick={() => onSignOut()}>
            Lock
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {error}
        </p>
      )}

      {t && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Visitors with a cloud copy" value={t.visitors} hint={`${t.new_week} new this week · ${t.new_day} today`} />
          <Stat label="Active (changed something)" value={t.active_day} hint={`today · ${t.active_week} this week`} />
          <Stat label="Listening now" value={t.listening} hint={`tabs with AI control on · ${t.queued_commands} commands queued`} />
          <Stat label="Devices signed in" value={t.devices} hint="browsers, sync links and AI links" />
          <Stat label="Password logins" value={t.logins} />
          <Stat label="Passkeys" value={t.passkeys} />
          <Stat label="Uploaded pictures" value={t.uploads} hint={bytes(t.upload_bytes)} />
          <Stat label="Saved settings" value={bytes(t.data_bytes)} hint="all visitors, text only" />
        </div>
      )}

      {data && data.listening.length > 0 && (
        <Section title="Listening now">
          <Table head={['Visitor', 'Mode', 'Playlist', 'Track', 'Volume', 'Seen']}>
            {data.listening.map((row) => (
              <tr key={row.profile_id}>
                <td className={TD}>
                  <button type="button" className="text-sky-400 hover:underline" onClick={() => setSelected(row.profile_id)}>
                    {row.username ?? shortId(row.profile_id)}
                  </button>
                </td>
                <td className={TD}>{row.state.modeName ?? '—'}</td>
                <td className={TD}>{row.state.playlistName ?? '—'}</td>
                <td className="max-w-xs truncate px-3 py-2">
                  <Track state={row.state} />
                </td>
                <td className={TD}>{row.state.muted ? 'muted' : (row.state.volume ?? '—')}</td>
                <td className={TD}>
                  <Time ms={row.seen_at} now={now} />
                </td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {data && (
        <Section
          title="Visitors"
          extra={
            <form
              role="search"
              className="flex w-full gap-2 sm:w-auto"
              onSubmit={(event) => {
                event.preventDefault();
                void load(query.trim());
              }}
            >
              <input
                className={INPUT}
                type="search"
                aria-label="Find a visitor by username or id"
                placeholder="Username or id"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              <button type="submit" className={BUTTON} disabled={loading}>
                Find
              </button>
            </form>
          }
        >
          <Table
            head={['Visitor', 'Joined', 'Last change', 'Devices', 'Passkeys', 'Modes', 'Playlists', 'Pictures', 'Size']}
            empty={data.visitors.length === 0 ? (searched ? `No visitor matches “${searched}”.` : 'No visitors yet.') : undefined}
          >
            {data.visitors.map((visitor) => (
              <tr key={visitor.id} className="hover:bg-zinc-900/60">
                <td className={TD}>
                  <button type="button" className="text-sky-400 hover:underline" onClick={() => setSelected(visitor.id)}>
                    {visitor.username ?? <span className="font-mono">{shortId(visitor.id)}</span>}
                  </button>
                  {visitor.seen_at && now - visitor.seen_at < 45_000 && (
                    <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-400">live</span>
                  )}
                </td>
                <td className={TD}>
                  <Time ms={visitor.created_at} now={now} />
                </td>
                <td className={TD}>
                  <Time ms={visitor.version} now={now} />
                </td>
                <td className={TD}>{visitor.devices}</td>
                <td className={TD}>{visitor.passkeys}</td>
                <td className={TD} title="added · edited">
                  {visitor.added_modes} · {visitor.edited_modes}
                </td>
                <td className={TD}>{visitor.playlists}</td>
                <td className={TD}>{visitor.uploads}</td>
                <td className={TD}>{bytes(visitor.data_bytes)}</td>
              </tr>
            ))}
          </Table>
          {data.more && (
            <div>
              <button type="button" className={BUTTON} disabled={loading} onClick={() => void load(searched, data.visitors.length)}>
                Show more
              </button>
            </div>
          )}
        </Section>
      )}

      {data && (
        <Section title="Password sign-in, last 15 minutes">
          <Table head={['Username', 'Tries', 'Since']} empty={data.lockouts.length === 0 ? 'No sign-in tries.' : undefined}>
            {data.lockouts.map((row) => (
              <tr key={row.username}>
                <td className={TD}>{row.username}</td>
                <td className={TD}>
                  {row.count}
                  {row.count >= 10 && <span className="ml-2 text-xs text-amber-400">locked</span>}
                </td>
                <td className={TD}>
                  <Time ms={row.since} now={now} />
                </td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {data && (
        <details className="rounded-xl border border-zinc-800 p-4">
          <summary className="cursor-pointer text-sm font-semibold tracking-wide text-zinc-400 uppercase">
            Site defaults ({data.defaults.length} rows in D1)
          </summary>
          <div className="mt-3">
            <Table head={['Kind', 'Id', 'Value']} empty={data.defaults.length === 0 ? 'No rows.' : undefined}>
              {data.defaults.map((row) => (
                <tr key={`${row.kind}:${row.id}`}>
                  <td className={TD}>{row.kind}</td>
                  <td className={TD}>{row.id}</td>
                  <td className="px-3 py-2 font-mono text-xs break-all">{row.value}</td>
                </tr>
              ))}
            </Table>
          </div>
        </details>
      )}
    </>
  );
}

function VisitorDetail({
  token,
  id,
  onBack,
  onSignOut,
}: {
  token: string;
  id: string;
  onBack: () => void;
  onSignOut: (reason?: string) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void get<Detail>(token, `?user=${encodeURIComponent(id)}`).then((result) => {
      if (!live) return;
      if (result.ok) setDetail(result.body);
      else if (keyProblem(result.status)) onSignOut(result.error);
      else setError(result.error);
    });
    return () => {
      live = false;
    };
  }, [token, id, onSignOut]);

  const now = detail?.now ?? Date.now();
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-50">{detail?.login?.username ?? 'Visitor'}</h1>
          <p className="font-mono text-xs text-zinc-500">{id}</p>
        </div>
        <button type="button" className={BUTTON} onClick={onBack}>
          ← All visitors
        </button>
      </header>

      {error && (
        <p role="alert" className="text-sm text-amber-300">
          {error}
        </p>
      )}
      {!detail && !error && <p className="text-sm text-zinc-400">Loading…</p>}

      {detail && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Joined" value={<Time ms={detail.created_at} now={now} />} />
            <Stat label="Last change" value={<Time ms={detail.version} now={now} />} />
            <Stat label="Devices" value={detail.devices.length} />
            <Stat
              label="Password login"
              value={detail.login ? detail.login.username : '—'}
              hint={detail.login ? <>set <Time ms={detail.login.created_at} now={now} /></> : 'none set'}
            />
          </div>

          {detail.remote && (
            <Section title="Player">
              <div className="rounded-xl border border-zinc-800 p-4 text-sm">
                <p>
                  <Track state={detail.remote.state} />
                </p>
                <p className="mt-1 text-zinc-400">
                  {detail.remote.state.modeName ?? '—'} · {detail.remote.state.playlistName ?? '—'} · last heard{' '}
                  <Time ms={detail.remote.seen_at} now={now} />
                </p>
                {detail.commands.length > 0 && (
                  <p className="mt-2 text-zinc-400">
                    Queued: {detail.commands.map((command) => command.action + (command.value ? ` ${command.value}` : '')).join(', ')}
                  </p>
                )}
              </div>
            </Section>
          )}

          <Section title="Devices and passkeys">
            <Table head={['What', 'Added']} empty={detail.devices.length + detail.passkeys.length === 0 ? 'None.' : undefined}>
              {detail.devices.map((at, index) => (
                <tr key={`d${index}`}>
                  <td className={TD}>Device key {index + 1}</td>
                  <td className={TD}>
                    <Time ms={at} now={now} />
                  </td>
                </tr>
              ))}
              {detail.passkeys.map((passkey) => (
                <tr key={passkey.credential_id}>
                  <td className={TD}>
                    Passkey <span className="font-mono text-xs text-zinc-500">{passkey.credential_id.slice(0, 10)}…</span>
                    {Array.isArray(passkey.transports) && passkey.transports.length > 0 && (
                      <span className="text-zinc-500"> · {passkey.transports.join(', ')}</span>
                    )}
                  </td>
                  <td className={TD}>
                    <Time ms={passkey.created_at} now={now} />
                  </td>
                </tr>
              ))}
            </Table>
          </Section>

          {detail.uploads.length > 0 && (
            <Section title={`Pictures (${detail.uploads.length})`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {detail.uploads.map((upload) => (
                  <figure key={upload.mode_id} className="overflow-hidden rounded-xl border border-zinc-800">
                    {/* Only raster data URLs ever reach this table (checked on upload); anything else isn't shown. */}
                    {upload.still.startsWith('data:image/') && (
                      <img src={upload.still} alt={`Picture for ${upload.mode_id}`} className="aspect-video w-full object-cover" loading="lazy" />
                    )}
                    <figcaption className="px-2 py-1 text-xs text-zinc-400">
                      {upload.mode_id} · {bytes(upload.still.length)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Section>
          )}

          <details className="rounded-xl border border-zinc-800 p-4" open>
            <summary className="cursor-pointer text-sm font-semibold tracking-wide text-zinc-400 uppercase">
              Saved settings
            </summary>
            <pre className="mt-3 max-h-128 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-300">
              {JSON.stringify(detail.data, null, 2)}
            </pre>
          </details>
        </>
      )}
    </>
  );
}
