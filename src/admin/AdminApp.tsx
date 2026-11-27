import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { GoogleButton } from '@/components/account/GoogleButton';

/*
 * The owner's view of every visitor, over functions/api/admin.ts (read-only).
 *
 * Two ways in: "Continue with Google" with an account listed in ADMIN_EMAILS
 * (its ID token is the credential, and lapses after an hour), or the owner key
 * (MCP_ADMIN_TOKEN) typed in. Either is kept in sessionStorage, so it is gone
 * when the tab closes and never sits in localStorage. Nothing
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
  /** Profiles linked to a Google account (functions/api/google.ts). */
  google: number;
  uploads: number;
  upload_bytes: number;
  data_bytes: number;
  listening: number;
  queued_commands: number;
  /** Anonymous tabs playing music right now (functions/api/listen.ts). */
  playing_now: number;
  /** Tabs that opened the site (functions/api/visit.ts): today (UTC), last 7 and 30 days. */
  visits_day: number;
  visits_week: number;
  visits_month: number;
}

interface Count {
  name: string;
  n: number;
}

/** An anonymous tab playing music: no name, no profile — see src/components/Analytics.tsx. */
interface Playing {
  mode: string;
  mode_name: string | null;
  playlist_name: string | null;
  track: string | null;
  seen_at: number;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
}

interface Visitor {
  id: string;
  username: string | null;
  /** The linked Google account's email, if any. */
  google: string | null;
  created_at: number;
  version: number;
  data_bytes: number;
  added_modes: number;
  edited_modes: number;
  playlists: number;
  devices: number;
  uploads: number;
  seen_at: number | null;
  /** Linked activity (functions/api/session.ts, listen.ts): the last visit, and all listening. */
  last_visit: number | null;
  listened_ms: number;
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
  defaults: { kind: string; id: string; value: string }[];
  playing: Playing[];
  visits: {
    days: number;
    perDay: { day: string; n: number }[];
    browser: Count[];
    os: Count[];
    device: Count[];
    country: Count[];
  };
  engagement: Engagement;
  /** Page speed and returning visitors (migrations/0012_insights.sql). Absent from an older API. */
  insights?: {
    speed: { name: string; n: number; load_ms: number | null; lcp_ms: number | null }[];
    returning: { seen_week: number; returning_week: number; new_week: number; remembered: number; avg_days_month: number };
  };
}

/** Counts that are things going wrong, shown under "Problems" rather than "What people use". */
const PROBLEMS = new Set(['crash', 'js_error', 'player_error', 'save_failed']);

/** One tab's visit (functions/api/session.ts): no id, nothing that links it to another. */
interface SessionRow {
  started_at: number;
  last_at: number;
  open_ms: number;
  visible_ms: number;
  listened_ms: number;
  first_mode: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
}

/** How long people stay and listen, and what they use (migrations/0007_sessions.sql). */
interface Engagement {
  sessions_day: number;
  sessions_week: number;
  avg_visible_ms: number;
  avg_open_ms: number;
  avg_listened_ms: number;
  visible_ms_week: number;
  listened_ms_day: number;
  listened_ms_week: number;
  listened_ms_month: number;
  perDay: { day: string; ms: number }[];
  modes: { mode: string; name: string | null; ms: number }[];
  playlists: { name: string | null; mode: string | null; ms: number }[];
  tracks: { name: string; mode: string | null; ms: number }[];
  events: { name: string; detail: string; n: number }[];
  sessions: SessionRow[];
  lengths: Count[];
}

interface Detail {
  now: number;
  id: string;
  created_at: number;
  version: number;
  data: unknown;
  login: { username: string; created_at: number } | null;
  google: { email: string | null; created_at: number } | null;
  /** Present while the person leaves "Link my activity" on (migrations/0009_account_activity.sql). */
  activity: {
    visits: (SessionRow & { events: { name: string; detail: string; n: number }[] })[];
    songs: { name: string; mode: string | null; ms: number }[];
    modes: { mode: string; name: string | null; ms: number }[];
    playlists: { name: string | null; mode: string | null; ms: number }[];
    perDay: { day: string; ms: number }[];
  };
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

/** 45 s · 12 min · 3 h 5 min */
function duration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

/** What each counted use means, in words (src/utils/analytics.ts → track()). Unknown names show as they are. */
const USES: Record<string, string> = {
  mode: 'Mode shown',
  playlist: 'Playlist picked',
  enter: 'Entered from the landing screen',
  song_start: 'Song started',
  skip: 'Skipped a song',
  shuffle: 'Shuffle',
  repeat: 'Repeat',
  mute: 'Mute',
  player_error: 'Player error',
  panel: 'Opened a panel',
  shortcut: 'Keyboard shortcut',
  preference: 'Changed a setting',
  mode_added: 'Added a mode',
  mode_deleted: 'Deleted a mode',
  mode_reset: 'Reset a mode',
  playlist_added: 'Added a playlist',
  restore: 'Restored from a file',
  download: 'Downloaded a file',
  reset_everything: 'Reset everything',
  sign_in: 'Signed in',
  google_linked: 'Connected a Google account',
  sign_out: 'Signed out',
  sync_link_made: 'Made a sync link',
  ai_link_made: 'Made an AI assistant link',
  ai_control: 'Let AI control a tab',
  passkey_added: 'Added a passkey',
  password_set: 'Set or changed a password',
  sign_out_others: 'Signed out other devices',
  cloud_deleted: 'Deleted the cloud copy',
  install: 'Install as an app',
  crash: 'The app crashed',
  js_error: 'Script error (kind @ file)',
  save_failed: 'Cloud save failed (HTTP status)',
};

/** 1840 → "1.8 s". */
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

const regions = new Intl.DisplayNames(undefined, { type: 'region' });
/** 'IN' → 'India'. Cloudflare also sends 'XX' (unknown) and 'T1' (Tor), which aren't regions. */
function countryName(code: string | null): string {
  if (!code || code === 'XX') return 'Unknown';
  if (code === 'T1') return 'Tor';
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** One way of splitting the visits (by browser, system…): each value, its count, its share. */
function Breakdown({
  title,
  rows,
  total,
  label = (name) => name,
  shares = true,
  format = String,
  empty = 'No visits yet.',
}: {
  title: string;
  rows: Count[];
  total: number;
  label?: (name: string) => string;
  /** False when `total` is only the scale (visits per day), not the whole. */
  shares?: boolean;
  /** How a value reads: a count by default, or a duration for listening time. */
  format?: (n: number) => string;
  empty?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="font-mono text-xs font-semibold tracking-[0.14em] text-zinc-300 uppercase">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {rows.map((row, index) => {
            const share = total ? Math.round((row.n / total) * 100) : 0;
            return (
              <li key={`${index}:${row.name}`} className="flex flex-col gap-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{label(row.name)}</span>
                  <span className="text-zinc-400 tabular-nums">
                    {shares ? `${format(row.n)} · ${share}%` : format(row.n)}
                  </span>
                </div>
                {/* A native meter, not a styled div: the page's CSP allows no inline styles. */}
                <meter className="h-1.5 w-full" min={0} max={total || 1} value={row.n} aria-label={`${label(row.name)}: ${share}%`} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Listeners per mode, most first. */
function byMode(rows: Playing[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.mode_name ?? row.mode;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

/**
 * "Owner key", or the Google email inside an ID token. Display only: the
 * token is read, never trusted, here — functions/api/admin.ts verifies it.
 */
function signedInAs(token: string): string {
  const payload = token.split('.')[1];
  if (!payload) return 'Owner key';
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { email?: unknown };
    return typeof claims.email === 'string' ? `${claims.email} · Google` : 'Google';
  } catch {
    return 'Google';
  }
}

const BUTTON =
  'rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:border-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500 disabled:opacity-40';
const INPUT =
  'w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500';

function Section({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-xs font-semibold tracking-[0.14em] text-zinc-300 uppercase">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="font-mono text-[0.7rem] tracking-wider text-zinc-400 uppercase">{label}</div>
      {/* Truncated: some values are emails, and at this size one ran out of the tile. */}
      <div
        className="mt-2 truncate text-3xl font-semibold tracking-tight text-zinc-50 tabular-nums"
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </div>
      {hint && <div className="mt-1 font-mono text-[0.7rem] text-zinc-500">{hint}</div>}
    </div>
  );
}

/** A table that scrolls sideways on its own on a narrow screen, not the page. */
function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-900 font-mono text-[0.7rem] tracking-wider text-zinc-400 uppercase">
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className="px-3 py-2.5 font-semibold whitespace-nowrap">
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
  const [clientId, setClientId] = useState<string | null>(null);
  useEffect(() => {
    // No Google button when sign-in isn't set up, or the API can't be reached: the key form still works.
    fetch('/api/google', { cache: 'no-store' })
      .then((response) => response.json())
      .then((body: { clientId?: unknown }) => setClientId(typeof body.clientId === 'string' ? body.clientId : null))
      .catch(() => setClientId(null));
  }, []);
  return (
    <form
      className="mx-auto mt-16 flex w-full max-w-sm flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) onToken(value.trim());
      }}
    >
      <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-50">
        <span className="size-2.5 rounded-full bg-amber-400" aria-hidden="true" />
        Vibe Mode admin
      </h1>
      {clientId && (
        <>
          <p className="text-sm text-zinc-400">Sign in with a Google account that is an admin of this site.</p>
          <GoogleButton clientId={clientId} onCredential={onToken} className="flex min-h-10 justify-start" />
          <p className="text-xs text-zinc-500">Or use the owner key.</p>
        </>
      )}
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

  const tab = useHashTab();
  const [auto, setAuto] = useState(() => {
    try {
      return sessionStorage.getItem(AUTO_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(AUTO_KEY, auto ? 'on' : 'off');
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
  }, [auto]);
  // Live tab only — elsewhere a refresh would reset a search or "Show more" —
  // and never while this tab is hidden: each refresh is a billed request.
  useEffect(() => {
    if (!auto || tab !== 'live' || selected) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(searched);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [auto, tab, selected, load, searched]);

  if (selected) {
    return <VisitorDetail token={token} id={selected} onBack={() => setSelected(null)} onSignOut={onSignOut} />;
  }

  const t = data?.totals;
  const now = data?.now ?? Date.now();
  const problems = data ? data.engagement.events.filter((row) => PROBLEMS.has(row.name)) : [];
  const problemCount = problems.reduce((sum, row) => sum + row.n, 0);
  const badges: Partial<Record<Tab, number>> = { live: data?.playing.length ?? 0, health: problemCount };

  return (
    <>
      {/* Sticky, so the tabs and Refresh stay in reach on a long page. */}
      <header className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-b border-zinc-800 bg-zinc-950/90 px-4 pt-4 pb-0 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-50">
              <span className="size-2.5 rounded-full bg-amber-400" aria-hidden="true" />
              Vibe Mode admin
            </h1>
            <p className="font-mono text-xs text-zinc-400" role="status">
              {loading ? 'Loading…' : data ? <>Updated <Time ms={data.now} now={Date.now()} /></> : ' '}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Who this tab is signed in as — read from the token for display only;
                the server checks it on every call. */}
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-xs text-zinc-300">
              {signedInAs(token)}
            </span>
            {/* Every refresh is a billed request: off-able, Live tab only, and
                paused while this tab is hidden. */}
            <label className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300">
              <input type="checkbox" className="accent-emerald-400" checked={auto} onChange={(event) => setAuto(event.currentTarget.checked)} />
              Auto-refresh
            </label>
            <button type="button" className={BUTTON} disabled={loading} onClick={() => void load(searched)}>
              Refresh
            </button>
            <button type="button" className={BUTTON} onClick={() => onSignOut()}>
              Lock
            </button>
          </div>
        </div>
        <nav aria-label="Admin sections" className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={tab === item.id ? 'page' : undefined}
              className={
                tab === item.id
                  ? 'flex shrink-0 items-center gap-2 border-b-2 border-amber-400 px-3 py-2 text-sm font-medium text-zinc-50'
                  : 'flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200'
              }
            >
              {item.label}
              {(badges[item.id] ?? 0) > 0 && (
                <span
                  className={
                    item.id === 'health'
                      ? 'rounded-full bg-amber-500/15 px-1.5 font-mono text-xs text-amber-300 tabular-nums'
                      : 'rounded-full bg-emerald-500/15 px-1.5 font-mono text-xs text-emerald-300 tabular-nums'
                  }
                >
                  {badges[item.id]}
                </span>
              )}
            </a>
          ))}
        </nav>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {error}
        </p>
      )}

      {!data && !error && <p className="text-sm text-zinc-400">Loading…</p>}

      {/* ── Live: what is happening right now ─────────────────────────────── */}
      {tab === 'live' && data && t && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Listening now"
              value={
                <span className="flex items-center gap-2">
                  {t.playing_now > 0 && <span className="size-2.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />}
                  {t.playing_now}
                </span>
              }
              hint="tabs playing music · all visitors"
            />
            <Stat
              label="Visits today"
              value={t.visits_day}
              hint={`${t.visits_week} in 7 days · ${t.visits_month} in 30`}
            />
            <Stat
              label="Listened today"
              value={duration(data.engagement.listened_ms_day)}
              hint={`${duration(data.engagement.listened_ms_week)} in 7 days · ${duration(data.engagement.listened_ms_month)} in 30`}
            />
            <Stat
              label="Time on site, per visit"
              value={duration(data.engagement.avg_visible_ms)}
              hint={`on screen, last 7 days · listening ${duration(data.engagement.avg_listened_ms)}`}
            />
          </div>

          <Section title="Listening now">
            {data.playing.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Listeners by mode">
                {byMode(data.playing).map(([mode, count]) => (
                  <li key={mode} className="rounded-full border border-zinc-700 px-3 py-1 text-sm">
                    {mode} <span className="text-zinc-400 tabular-nums">· {count}</span>
                  </li>
                ))}
              </ul>
            )}
            <Table
              head={['Mode', 'Playlist', 'Song', 'On', 'Where', 'Heard']}
              empty={
                data.playing.length === 0
                  ? 'Nobody is playing music right now. Browsers that send a privacy signal and haven’t allowed stats aren’t counted.'
                  : undefined
              }
            >
              {data.playing.map((row, index) => (
                <tr key={index}>
                  <td className={TD}>{row.mode_name ?? row.mode}</td>
                  <td className={TD}>{row.playlist_name ?? '—'}</td>
                  <td className="max-w-md truncate px-3 py-2">{row.track ?? <span className="text-zinc-500">—</span>}</td>
                  <td className={TD}>{row.browser ? `${row.browser} · ${row.os} · ${capital(row.device ?? '')}` : '—'}</td>
                  <td className={TD}>{countryName(row.country)}</td>
                  <td className={TD}>
                    <Time ms={row.seen_at} now={now} />
                  </td>
                </tr>
              ))}
            </Table>
          </Section>

          <Section title="AI-controlled tabs, now">
            <Table
              head={['Visitor', 'Mode', 'Playlist', 'Track', 'Volume', 'Seen']}
              empty={data.listening.length === 0 ? 'No tab has “Let AI control this tab” on right now.' : undefined}
            >
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
        </>
      )}

      {/* ── Listening: what plays, over time ──────────────────────────────── */}
      {tab === 'listening' && data && (
        <>
          <BarChart
            title="Listening per day (UTC)"
            rows={data.engagement.perDay.map((row) => ({ day: row.day, n: row.ms }))}
            days={data.visits.days}
            now={now}
            format={duration}
            empty="Nothing played yet."
          />
          <Section title={`Most played · last ${data.visits.days} days`}>
            <div className="grid gap-3 lg:grid-cols-3">
              <Breakdown
                title="Modes"
                rows={data.engagement.modes.map((row) => ({ name: row.name ?? row.mode, n: row.ms }))}
                total={data.engagement.listened_ms_month}
                format={duration}
                empty="Nothing played yet."
              />
              <Breakdown
                title="Playlists"
                rows={data.engagement.playlists.map((row) => ({ name: `${row.name ?? '—'} · ${row.mode ?? '—'}`, n: row.ms }))}
                total={data.engagement.listened_ms_month}
                format={duration}
                empty="Nothing played yet."
              />
              <Breakdown
                title="Songs"
                rows={data.engagement.tracks.map((row) => ({ name: row.name, n: row.ms }))}
                total={data.engagement.listened_ms_month}
                format={duration}
                empty="Nothing played yet."
              />
            </div>
          </Section>
        </>
      )}

      {/* ── Visitors: accounts and people ─────────────────────────────────── */}
      {tab === 'visitors' && data && t && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Cloud copies" value={t.visitors} hint={`${t.new_day} new in 24 h · ${t.new_week} in 7 days`} />
            <Stat label="Changed something" value={t.active_day} hint={`last 24 h · ${t.active_week} in 7 days`} />
            <Stat label="Google accounts" value={t.google} hint="signed in with Google" />
            <Stat label="Devices signed in" value={t.devices} hint="browsers, links, AI apps" />
            <Stat label="Pictures" value={t.uploads} hint={bytes(t.upload_bytes)} />
            <Stat label="Saved settings" value={bytes(t.data_bytes)} hint="all visitors, text only" />
          </div>

          {data.insights && (
            <Section title="Returning visitors · only browsers that allowed it">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Seen, 7 days" value={data.insights.returning.seen_week} />
                <Stat label="Came back" value={data.insights.returning.returning_week} hint="seen on 2+ days" />
                <Stat label="New this week" value={data.insights.returning.new_week} />
                <Stat
                  label="Days per visitor"
                  value={data.insights.returning.avg_days_month.toFixed(1)}
                  hint={`last 30 days · ${data.insights.returning.remembered} remembered in all`}
                />
              </div>
            </Section>
          )}

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
                  aria-label="Find a visitor by username, Google email or id"
                  placeholder="Username, email or id"
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
              head={['Visitor', 'Joined', 'Last visit', 'Listened', 'Last change', 'Devices', 'Modes', 'Playlists', 'Pictures', 'Size']}
              empty={data.visitors.length === 0 ? (searched ? `No visitor matches “${searched}”.` : 'No visitors yet.') : undefined}
            >
              {data.visitors.map((visitor) => (
                <tr key={visitor.id} className="hover:bg-zinc-900/60">
                  <td className={TD}>
                    <button type="button" className="text-sky-400 hover:underline" onClick={() => setSelected(visitor.id)}>
                      {visitor.google ?? visitor.username ?? <span className="font-mono">{shortId(visitor.id)}</span>}
                    </button>
                    {visitor.seen_at && now - visitor.seen_at < 45_000 && (
                      <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-400">live</span>
                    )}
                  </td>
                  <td className={TD}>
                    <Time ms={visitor.created_at} now={now} />
                  </td>
                  <td className={TD}>
                    <Time ms={visitor.last_visit} now={now} />
                  </td>
                  <td className={TD}>{visitor.listened_ms ? duration(visitor.listened_ms) : '—'}</td>
                  <td className={TD}>
                    <Time ms={visitor.version} now={now} />
                  </td>
                  <td className={TD}>{visitor.devices}</td>
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
        </>
      )}

      {/* ── Traffic: visits, where from, on what ──────────────────────────── */}
      {tab === 'traffic' && data && t && (
        <>
          <BarChart
            title="Visits per day (UTC)"
            rows={data.visits.perDay}
            days={data.visits.days}
            now={now}
            format={String}
            empty="No visits yet."
          />
          <Section title={`Browsers, systems and devices · last ${data.visits.days} days`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Breakdown title="Browser" rows={data.visits.browser} total={t.visits_month} />
              <Breakdown title="System" rows={data.visits.os} total={t.visits_month} />
              <Breakdown title="Device" rows={data.visits.device} total={t.visits_month} label={capital} />
              <Breakdown title="Country" rows={data.visits.country} total={t.visits_month} label={countryName} />
            </div>
          </Section>
          <Section title="How long visits last · last 7 days">
            <Breakdown
              title="Time on screen per visit"
              rows={data.engagement.lengths}
              total={data.engagement.lengths.reduce((sum, row) => sum + row.n, 0)}
              empty="No visits reported yet — a visit is reported when its tab is hidden or closed."
            />
          </Section>
          <Section title={`What people use · last ${data.visits.days} days`}>
            <Table head={['Use', 'Detail', 'Times']} empty={data.engagement.events.length === 0 ? 'Nothing counted yet.' : undefined}>
              {data.engagement.events
                .filter((row) => !PROBLEMS.has(row.name))
                .map((row) => (
                  <tr key={`${row.name}:${row.detail}`}>
                    <td className={TD}>{USES[row.name] ?? row.name}</td>
                    <td className="px-3 py-2">{row.detail || <span className="text-zinc-500">—</span>}</td>
                    <td className={TD}>{row.n}</td>
                  </tr>
                ))}
            </Table>
          </Section>
          <Section title="Recent visits">
            <Table
              head={['Started', 'On screen', 'Tab open', 'Listening', 'Landed on', 'On', 'Where']}
              empty={data.engagement.sessions.length === 0 ? 'No visits reported yet.' : undefined}
            >
              {data.engagement.sessions.map((row, index) => (
                <tr key={index}>
                  <td className={TD}>
                    <Time ms={row.started_at} now={now} />
                  </td>
                  <td className={TD}>{duration(row.visible_ms)}</td>
                  <td className={TD}>{duration(row.open_ms)}</td>
                  <td className={TD}>{row.listened_ms ? duration(row.listened_ms) : '—'}</td>
                  <td className={TD}>{row.first_mode ?? '—'}</td>
                  <td className={TD}>{row.browser ? `${row.browser} · ${row.os} · ${capital(row.device ?? '')}` : '—'}</td>
                  <td className={TD}>{countryName(row.country)}</td>
                </tr>
              ))}
            </Table>
          </Section>
        </>
      )}

      {/* ── Health: what broke, how fast ──────────────────────────────────── */}
      {tab === 'health' && data && (
        <>
          <Section title={`Problems · last ${data.visits.days} days`}>
            <Table head={['What went wrong', 'Detail', 'Times']} empty={problems.length === 0 ? 'Nothing has gone wrong.' : undefined}>
              {problems.map((row) => (
                <tr key={`${row.name}:${row.detail}`}>
                  <td className={TD}>{USES[row.name] ?? row.name}</td>
                  <td className="px-3 py-2">{row.detail || <span className="text-zinc-500">—</span>}</td>
                  <td className={TD}>{row.n}</td>
                </tr>
              ))}
            </Table>
          </Section>
          <Section title="Speed · last 7 days">
            <Table
              head={['Device', 'Visits measured', 'Page loaded', 'Largest paint']}
              empty={!data.insights || data.insights.speed.length === 0 ? 'No visits measured yet.' : undefined}
            >
              {(data.insights?.speed ?? []).map((row) => (
                <tr key={row.name}>
                  <td className={TD}>{capital(row.name ?? '—')}</td>
                  <td className={TD}>{row.n}</td>
                  <td className={TD}>{row.load_ms === null ? '—' : <Speed ms={row.load_ms} good={3000} />}</td>
                  <td className={TD}>{row.lcp_ms === null ? '—' : <Speed ms={row.lcp_ms} good={2500} />}</td>
                </tr>
              ))}
            </Table>
            <p className="text-xs text-zinc-500">Green is good, amber needs a look: Google counts a largest paint under 2.5 s as good.</p>
          </Section>
        </>
      )}

      {/* ── Site: the defaults every visitor gets ─────────────────────────── */}
      {tab === 'site' && data && (
        <Section title={`Site defaults · ${data.defaults.length} rows in D1`}>
          <Table head={['Kind', 'Id', 'Value']} empty={data.defaults.length === 0 ? 'No rows.' : undefined}>
            {data.defaults.map((row) => (
              <tr key={`${row.kind}:${row.id}`}>
                <td className={TD}>{row.kind}</td>
                <td className={TD}>{row.id}</td>
                <td className="px-3 py-2 font-mono text-xs break-all">{row.value}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
    </>
  );
}

/* ── Tabs ───────────────────────────────────────────────────────────────── */

/** sessionStorage: whether the Live tab refreshes itself. On unless switched off in this tab. */
const AUTO_KEY = 'vibe-mode.adminAuto';
const AUTO_REFRESH_MS = 30_000;

const TABS = [
  { id: 'live', label: 'Live' },
  { id: 'listening', label: 'Listening' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'health', label: 'Health' },
  { id: 'site', label: 'Site' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const tabFromHash = (): Tab => {
  const hash = window.location.hash.slice(1);
  return TABS.some((item) => item.id === hash) ? (hash as Tab) : 'live';
};

/**
 * The open tab, kept in the address (#visitors) — plain links, so Back,
 * bookmarks and a refresh all land on the same tab, with no ARIA tab widget.
 */
function useHashTab(): Tab {
  const [tab, setTab] = useState(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return tab;
}

/** "1.8 s", green under `good` ms and amber over it. */
function Speed({ ms, good }: { ms: number; good: number }) {
  return <span className={ms <= good ? 'text-emerald-400' : 'text-amber-300'}>{seconds(ms)}</span>;
}

/** 'YYYY-MM-DD' (UTC) for `back` days before `now`, as the API writes days. */
const utcDay = (now: number, back: number) => new Date(now - back * 86_400_000).toISOString().slice(0, 10);

/**
 * One bar per day, oldest left. SVG attributes, not inline styles: the page's
 * CSP keeps styles to its own stylesheet. Days with nothing get an empty slot,
 * so gaps read as quiet days instead of disappearing.
 */
function BarChart({
  title,
  rows,
  days,
  now,
  format,
  empty,
}: {
  title: string;
  rows: { day: string; n: number }[];
  days: number;
  now: number;
  format: (n: number) => string;
  empty: string;
}) {
  const byDay = new Map(rows.map((row) => [row.day, row.n]));
  const series = Array.from({ length: days }, (_, index) => {
    const day = utcDay(now, days - 1 - index);
    return { day, n: byDay.get(day) ?? 0 };
  });
  const max = Math.max(1, ...series.map((row) => row.n));
  const total = series.reduce((sum, row) => sum + row.n, 0);
  const width = 100;
  const height = 40;
  const slot = width / series.length;
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-semibold tracking-[0.14em] text-zinc-300 uppercase">{title}</h2>
        <span className="font-mono text-xs text-zinc-400 tabular-nums">
          {format(total)} in {days} days · today {format(series[series.length - 1].n)}
        </span>
      </div>
      {total === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{empty}</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="mt-3 h-32 w-full"
            role="img"
            aria-label={`${title}: ${series
              .filter((row) => row.n > 0)
              .map((row) => `${dayLabel(row.day)} ${format(row.n)}`)
              .join(', ')}`}
          >
            {series.map((row, index) => {
              const barHeight = row.n ? Math.max((row.n / max) * height, 0.8) : 0;
              return (
                <rect
                  key={row.day}
                  x={index * slot + slot * 0.15}
                  y={height - barHeight}
                  width={slot * 0.7}
                  height={barHeight}
                  rx={0.3}
                  className={index === series.length - 1 ? 'fill-amber-400' : 'fill-emerald-400/80 hover:fill-emerald-300'}
                >
                  <title>{`${dayLabel(row.day)}: ${format(row.n)}`}</title>
                </rect>
              );
            })}
          </svg>
          <div className="mt-1 flex justify-between font-mono text-[0.65rem] text-zinc-500">
            <span>{dayLabel(series[0].day)}</span>
            <span>today</span>
          </div>
        </>
      )}
    </section>
  );
}

/** What one account listened to: songs, modes, playlists and days, by time played. */
function ActivityListening({ activity }: { activity: Detail['activity'] }) {
  const total = activity.perDay.reduce((sum, day) => sum + day.ms, 0);
  if (!total) return null;
  return (
    <Section title="Listening">
      <div className="grid gap-3 lg:grid-cols-3">
        <Breakdown
          title="Songs"
          rows={activity.songs.map((row) => ({ name: row.name, n: row.ms }))}
          total={total}
          format={duration}
        />
        <Breakdown
          title="Modes"
          rows={activity.modes.map((row) => ({ name: row.name ?? row.mode, n: row.ms }))}
          total={total}
          format={duration}
        />
        <Breakdown
          title="Playlists"
          rows={activity.playlists.map((row) => ({ name: `${row.name ?? '—'} · ${row.mode ?? '—'}`, n: row.ms }))}
          total={total}
          format={duration}
        />
      </div>
      <Breakdown
        title="Per day (UTC)"
        rows={activity.perDay.map((row) => ({ name: row.day, n: row.ms }))}
        total={Math.max(...activity.perDay.map((row) => row.ms))}
        shares={false}
        format={duration}
        label={dayLabel}
      />
    </Section>
  );
}

/**
 * Everything that happened on one account, newest first: the account's own
 * milestones (joined, devices, passkeys, password, Google) and each linked
 * visit with the features used in it.
 */
function History({ detail, now }: { detail: Detail; now: number }) {
  const uses = (events: { name: string; detail: string; n: number }[]) =>
    events.map((use) => `${USES[use.name] ?? use.name}${use.detail ? ` (${use.detail})` : ''}${use.n > 1 ? ` ×${use.n}` : ''}`).join(' · ');

  const entries: { at: number; what: string; detail: string; extra?: string }[] = [
    { at: detail.created_at, what: 'Joined', detail: 'First cloud save' },
    { at: detail.version, what: 'Last change', detail: 'Their modes, playlists or settings were saved' },
    ...detail.devices.map((at) => ({ at, what: 'Device signed in', detail: 'A browser, sync link, sign-in or AI link' })),
    ...detail.passkeys.map((passkey) => ({ at: passkey.created_at, what: 'Passkey added', detail: '' })),
    ...(detail.login ? [{ at: detail.login.created_at, what: 'Password set', detail: detail.login.username }] : []),
    ...(detail.google ? [{ at: detail.google.created_at, what: 'Google connected', detail: detail.google.email ?? '' }] : []),
    ...detail.activity.visits.map((visit) => ({
      at: visit.started_at,
      what: 'Visit',
      detail: [
        `${duration(visit.visible_ms)} on screen`,
        visit.listened_ms ? `${duration(visit.listened_ms)} listening` : 'no music',
        visit.first_mode ? `landed on ${visit.first_mode}` : null,
        visit.browser ? `${visit.browser} · ${visit.os} · ${capital(visit.device ?? '')}` : null,
        countryName(visit.country),
      ]
        .filter(Boolean)
        .join(' · '),
      extra: visit.events.length ? uses(visit.events) : undefined,
    })),
  ].sort((a, b) => b.at - a.at);

  return (
    <Section title="History">
      {detail.activity.visits.length === 0 && (
        <p className="text-sm text-zinc-500">
          No linked visits yet. They appear once this person visits with “Link my activity to my account” on (the
          default) — visits from before that, or with it off, stay anonymous.
        </p>
      )}
      <Table head={['When', 'What', 'Details']}>
        {entries.map((entry, index) => (
          <tr key={index} className="align-top">
            <td className={TD}>
              <Time ms={entry.at} now={now} />
            </td>
            <td className={TD}>{entry.what}</td>
            <td className="px-3 py-2">
              {entry.detail || <span className="text-zinc-500">—</span>}
              {entry.extra && <div className="mt-1 text-xs text-zinc-400">Used: {entry.extra}</div>}
            </td>
          </tr>
        ))}
      </Table>
    </Section>
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
          <h1 className="text-xl font-semibold text-zinc-50">
            {detail?.google?.email ?? detail?.login?.username ?? 'Visitor'}
          </h1>
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
              label="Google account"
              value={detail.google ? (detail.google.email ?? 'linked') : '—'}
              hint={detail.google ? <>linked <Time ms={detail.google.created_at} now={now} /></> : 'not linked'}
            />
            <Stat
              label="Last visit"
              value={<Time ms={detail.activity.visits[0]?.last_at ?? null} now={now} />}
              hint={`${detail.activity.visits.length} linked visits`}
            />
            <Stat
              label="Time on site"
              value={duration(detail.activity.visits.reduce((sum, visit) => sum + visit.visible_ms, 0))}
              hint="on screen, all linked visits"
            />
            <Stat
              label="Listened"
              value={duration(detail.activity.perDay.reduce((sum, day) => sum + day.ms, 0))}
              hint={`${detail.activity.songs.length} different songs`}
            />
          </div>

          <ActivityListening activity={detail.activity} />
          <History detail={detail} now={now} />

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

          <Section title="Devices">
            <Table head={['What', 'Added']} empty={detail.devices.length === 0 ? 'None.' : undefined}>
              {detail.devices.map((at, index) => (
                <tr key={`d${index}`}>
                  <td className={TD}>Device key {index + 1}</td>
                  <td className={TD}>
                    <Time ms={at} now={now} />
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
