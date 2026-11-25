import { fail, isOwner, json, type Env, type Handler } from '../../server/lib';

// The owner's view of every visitor, for the admin page (admin.html → /admin).
// Read-only: nothing here changes a row. The caller must send
// `Authorization: Bearer <MCP_ADMIN_TOKEN>`; with that secret unset, nobody gets in.
//
//   GET /api/admin                      totals, who is listening now, lockouts,
//                                       site defaults, and a page of visitors
//       ?q=<username or id start>       … only visitors that match
//       &offset=<n>                     … the next page
//   GET /api/admin?user=<profile id>    one visitor: everything stored for them
//
// Besides what visitors save, it shows the anonymous "now playing" pings
// (functions/api/listen.ts), which the app tells visitors about. There is no
// IP, page view or location log; adding one would need a privacy notice first.

const DAY_MS = 86_400_000;
/** A tab counts as listening if it polled this recently (it polls every 4 s); as in server/mcp.ts. */
const LISTENING_MS = 45_000;
/** An anonymous listener counts if it pinged this recently (it pings every 60 s; background tabs can run late). */
const PLAYING_MS = 150_000;
const LOCKOUT_MS = 15 * 60_000;
const PAGE = 50;
/** Breakdowns of visits cover this many days, today included. */
const VISIT_DAYS = 30;
/** The columns of `visits` a breakdown may group by — names, so never bound, only picked from here. */
const BUCKETS = ['browser', 'os', 'device', 'country'] as const;

/** 'YYYY-MM-DD' (UTC) for `days` days before `now`, as functions/api/visit.ts writes it. */
const dayOf = (now: number, days = 0) => new Date(now - days * DAY_MS).toISOString().slice(0, 10);

interface AdminVisitor {
  id: string;
  username: string | null;
  google: string | null;
  created_at: number;
  /** Last change: every save and every MCP edit sets it to the time. */
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

export const onRequestGet: Handler = async ({ env, request }) => {
  // Said plainly, or the owner would keep retyping a "wrong" key on a site
  // where no key can be right. Tells a stranger only that it isn't set up.
  if ((env.MCP_ADMIN_TOKEN?.length ?? 0) < 32) {
    return fail(503, 'No owner key is set up. Add MCP_ADMIN_TOKEN (32+ characters) as a secret in the Pages project.');
  }
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if (!(await isOwner(env, token))) return fail(401, 'That isn’t the owner key.');
  const url = new URL(request.url);
  const id = url.searchParams.get('user');
  return id === null ? overview(env, url) : visitor(env, id);
};

async function overview(env: Env, url: URL): Promise<Response> {
  const now = Date.now();
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 60);
  const offset = Math.max(0, Math.min(Number(url.searchParams.get('offset')) || 0, 1_000_000));

  const since = dayOf(now, VISIT_DAYS - 1);
  const week = dayOf(now, 6);
  const [
    totals,
    visitors,
    listening,
    lockouts,
    defaults,
    playing,
    perDay,
    engagement,
    listenPerDay,
    topModes,
    topPlaylists,
    topTracks,
    events,
    sessions,
    lengths,
    ...buckets
  ] = await env.DB.batch([
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM profiles) AS visitors,
         (SELECT COUNT(*) FROM profiles WHERE created_at > ?1) AS new_day,
         (SELECT COUNT(*) FROM profiles WHERE created_at > ?2) AS new_week,
         (SELECT COUNT(*) FROM profiles WHERE version > ?1) AS active_day,
         (SELECT COUNT(*) FROM profiles WHERE version > ?2) AS active_week,
         (SELECT COUNT(*) FROM device_keys) AS devices,
         (SELECT COUNT(*) FROM passkeys) AS passkeys,
         (SELECT COUNT(*) FROM logins) AS logins,
         (SELECT COUNT(*) FROM google_accounts) AS google,
         (SELECT COUNT(*) FROM uploads) AS uploads,
         (SELECT COALESCE(SUM(octet_length(still)), 0) FROM uploads) AS upload_bytes,
         (SELECT COALESCE(SUM(octet_length(data)), 0) FROM profiles) AS data_bytes,
         (SELECT COUNT(*) FROM remote_state WHERE seen_at > ?3) AS listening,
         (SELECT COUNT(*) FROM remote_commands) AS queued_commands,
         (SELECT COUNT(*) FROM listeners WHERE playing = 1 AND seen_at > ?4) AS playing_now,
         (SELECT COALESCE(SUM(count), 0) FROM visits WHERE day = ?5) AS visits_day,
         (SELECT COALESCE(SUM(count), 0) FROM visits WHERE day >= ?6) AS visits_week,
         (SELECT COALESCE(SUM(count), 0) FROM visits WHERE day >= ?7) AS visits_month`,
    ).bind(
      now - DAY_MS,
      now - 7 * DAY_MS,
      now - LISTENING_MS,
      now - PLAYING_MS,
      dayOf(now),
      dayOf(now, 6),
      since,
    ),
    // `data` is stored as the browser sent it (it is sanitised on the way
    // back in), so the counts guard every shape: one odd profile must not
    // break the whole list. PAGE + 1 rows says whether there is a next page.
    env.DB.prepare(
      `SELECT p.id, l.username, g.email AS google, p.created_at, p.version, octet_length(p.data) AS data_bytes,
         COALESCE(json_array_length(p.data, '$.customization.added'), 0) AS added_modes,
         (SELECT COUNT(*) FROM json_each(p.data, '$.customization.edits')) AS edited_modes,
         (SELECT COALESCE(SUM(CASE WHEN type = 'array' THEN json_array_length(value) ELSE 0 END), 0)
            FROM json_each(p.data, '$.customPlaylists')) AS playlists,
         (SELECT COUNT(*) FROM device_keys k WHERE k.profile_id = p.id) AS devices,
         (SELECT COUNT(*) FROM passkeys k WHERE k.profile_id = p.id) AS passkeys,
         (SELECT COUNT(*) FROM uploads u WHERE u.profile_id = p.id) AS uploads,
         (SELECT seen_at FROM remote_state r WHERE r.profile_id = p.id) AS seen_at
       FROM profiles p
         LEFT JOIN logins l ON l.profile_id = p.id
         LEFT JOIN google_accounts g ON g.profile_id = p.id
       WHERE ?1 = '' OR instr(p.id, ?1) = 1 OR instr(l.username, ?1) > 0 OR instr(lower(g.email), ?1) > 0
       ORDER BY p.version DESC
       LIMIT ?2 OFFSET ?3`,
    ).bind(q, PAGE + 1, offset),
    env.DB.prepare(
      `SELECT r.profile_id, l.username, r.state, r.seen_at
       FROM remote_state r LEFT JOIN logins l ON l.profile_id = r.profile_id
       WHERE r.seen_at > ? ORDER BY r.seen_at DESC LIMIT 50`,
    ).bind(now - LISTENING_MS),
    env.DB.prepare(
      'SELECT username, count, since FROM login_failures WHERE since > ? ORDER BY count DESC LIMIT 50',
    ).bind(now - LOCKOUT_MS),
    env.DB.prepare('SELECT kind, id, value FROM defaults ORDER BY kind, id'),
    // Never the tab id: it is meaningless to the owner, and stays in the database.
    env.DB.prepare(
      `SELECT mode, mode_name, playlist_name, track, seen_at, browser, os, device, country FROM listeners
       WHERE playing = 1 AND seen_at > ? ORDER BY seen_at DESC LIMIT 200`,
    ).bind(now - PLAYING_MS),
    env.DB.prepare('SELECT day, SUM(count) AS n FROM visits WHERE day >= ? GROUP BY day ORDER BY day DESC').bind(since),
    // How long people stay and listen (migrations/0007_sessions.sql). Time on
    // site is "on screen", not "tab open": a forgotten background tab isn't a visit.
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM sessions WHERE day = ?1) AS sessions_day,
         (SELECT COUNT(*) FROM sessions WHERE day >= ?2) AS sessions_week,
         (SELECT COALESCE(AVG(visible_ms), 0) FROM sessions WHERE day >= ?2) AS avg_visible_ms,
         (SELECT COALESCE(AVG(open_ms), 0) FROM sessions WHERE day >= ?2) AS avg_open_ms,
         (SELECT COALESCE(AVG(listened_ms), 0) FROM sessions WHERE day >= ?2) AS avg_listened_ms,
         (SELECT COALESCE(SUM(visible_ms), 0) FROM sessions WHERE day >= ?2) AS visible_ms_week,
         (SELECT COALESCE(SUM(ms), 0) FROM listen_daily WHERE day = ?1) AS listened_ms_day,
         (SELECT COALESCE(SUM(ms), 0) FROM listen_daily WHERE day >= ?2) AS listened_ms_week,
         (SELECT COALESCE(SUM(ms), 0) FROM listen_daily WHERE day >= ?3) AS listened_ms_month`,
    ).bind(dayOf(now), week, since),
    env.DB.prepare('SELECT day, SUM(ms) AS ms FROM listen_daily WHERE day >= ? GROUP BY day ORDER BY day DESC').bind(since),
    env.DB.prepare(
      `SELECT mode, MAX(mode_name) AS name, SUM(ms) AS ms FROM listen_daily WHERE day >= ?
       GROUP BY mode ORDER BY ms DESC LIMIT 20`,
    ).bind(since),
    env.DB.prepare(
      `SELECT MAX(playlist_name) AS name, MAX(mode_name) AS mode, SUM(ms) AS ms FROM listen_daily
       WHERE day >= ? AND playlist <> '' GROUP BY mode, playlist ORDER BY ms DESC LIMIT 25`,
    ).bind(since),
    env.DB.prepare(
      `SELECT track AS name, MAX(mode_name) AS mode, SUM(ms) AS ms FROM listen_daily
       WHERE day >= ? AND track <> '' GROUP BY track ORDER BY ms DESC LIMIT 25`,
    ).bind(since),
    env.DB.prepare(
      `SELECT name, detail, SUM(count) AS n FROM events_daily WHERE day >= ?
       GROUP BY name, detail ORDER BY n DESC LIMIT 150`,
    ).bind(since),
    // Never the tab id, as for listeners.
    env.DB.prepare(
      `SELECT started_at, last_at, open_ms, visible_ms, listened_ms, first_mode, browser, os, device, country
       FROM sessions ORDER BY last_at DESC LIMIT 50`,
    ),
    env.DB.prepare(
      `SELECT CASE
           WHEN visible_ms < 60000 THEN 'Under 1 min'
           WHEN visible_ms < 300000 THEN '1–5 min'
           WHEN visible_ms < 900000 THEN '5–15 min'
           WHEN visible_ms < 3600000 THEN '15–60 min'
           ELSE 'Over 1 hour' END AS name,
         COUNT(*) AS n
       FROM sessions WHERE day >= ? GROUP BY name ORDER BY MIN(visible_ms)`,
    ).bind(week),
    ...BUCKETS.map((bucket) =>
      env.DB.prepare(
        `SELECT ${bucket} AS name, SUM(count) AS n FROM visits WHERE day >= ? GROUP BY ${bucket} ORDER BY n DESC LIMIT 25`,
      ).bind(since),
    ),
  ]);

  const rows = visitors.results as unknown as AdminVisitor[];
  return json({
    now,
    totals: totals.results[0],
    visitors: rows.slice(0, PAGE),
    more: rows.length > PAGE,
    listening: (listening.results as { profile_id: string; username: string | null; state: string; seen_at: number }[]).map(
      (row) => ({ ...row, state: parse(row.state) }),
    ),
    lockouts: lockouts.results,
    defaults: defaults.results,
    playing: playing.results,
    visits: {
      days: VISIT_DAYS,
      perDay: perDay.results,
      ...Object.fromEntries(BUCKETS.map((bucket, index) => [bucket, buckets[index].results])),
    },
    engagement: {
      ...(engagement.results[0] as Record<string, number>),
      perDay: listenPerDay.results,
      modes: topModes.results,
      playlists: topPlaylists.results,
      tracks: topTracks.results,
      events: events.results,
      sessions: sessions.results,
      lengths: lengths.results,
    },
  });
}

async function visitor(env: Env, id: string): Promise<Response> {
  const one = (sql: string) => env.DB.prepare(sql).bind(id);
  const [profile, login, keys, passkeys, uploads, remote, commands, google] = await env.DB.batch([
    one('SELECT id, data, version, created_at FROM profiles WHERE id = ?'),
    one('SELECT username, created_at FROM logins WHERE profile_id = ?'),
    one('SELECT created_at FROM device_keys WHERE profile_id = ? ORDER BY created_at DESC'),
    one('SELECT credential_id, transports, created_at FROM passkeys WHERE profile_id = ? ORDER BY created_at DESC'),
    one('SELECT mode_id, still FROM uploads WHERE profile_id = ? ORDER BY mode_id'),
    one('SELECT state, seen_at FROM remote_state WHERE profile_id = ?'),
    one('SELECT action, value, created_at FROM remote_commands WHERE profile_id = ? ORDER BY id'),
    one('SELECT email, created_at FROM google_accounts WHERE profile_id = ?'),
  ]);
  const row = profile.results[0] as { id: string; data: string; version: number; created_at: number } | undefined;
  if (!row) return fail(404, 'No visitor with that id.');
  const live = remote.results[0] as { state: string; seen_at: number } | undefined;
  return json({
    now: Date.now(),
    id: row.id,
    created_at: row.created_at,
    version: row.version,
    data: parse(row.data),
    login: login.results[0] ?? null,
    google: google.results[0] ?? null,
    // Key hashes say nothing useful; when each device was added does.
    devices: (keys.results as { created_at: number }[]).map((key) => key.created_at),
    passkeys: (passkeys.results as { credential_id: string; transports: string | null; created_at: number }[]).map(
      (passkey) => ({ ...passkey, transports: parse(passkey.transports ?? '[]') }),
    ),
    uploads: uploads.results,
    remote: live ? { state: parse(live.state), seen_at: live.seen_at } : null,
    commands: commands.results,
  });
}

/** Stored JSON, or the raw text if it somehow isn't — never a thrown error. */
function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
