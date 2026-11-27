import { fail, isKey, overLimit, memberForKey, readText, SAFE_ID, type Handler } from '../../server/lib';
import { classify, countryOf } from '../../server/ua';

// Anonymous "now playing", and the listening time behind the admin page's
// minutes per mode, playlist and song (migrations/0005_listeners.sql,
// 0007_sessions.sql; sent by src/components/Analytics.tsx). Open to anyone,
// like /api/config — it holds nothing about a person.
//
// Cost: one billed request and two D1 writes per playing tab per minute, so
// ~35 tabs playing all day use the free 100k writes/day (Workers Paid, $5/month,
// lifts that to 50M). Only the shape is checked: a script could invent
// listeners or minutes — the numbers are a guide, not a ledger.

/** How long a row is kept. The admin page counts rows seen in the last 150 s. */
const KEEP_MS = 10 * 60_000;
/** Sweep on 1 ping in 20: the table stays tiny without a full scan on every ping. */
const SWEEP_ODDS = 0.05;
/** The longest gap between two pings still counted as listening (pings come every 60 s). */
const CREDIT_MS = 150_000;

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

export const onRequestPost: Handler = async ({ env, request }) => {
  if (overLimit(request, 'listen', 150, 10 * 60_000)) return new Response(null, { status: 204 }); // dropped quietly
  const raw = await readText(request, 2_000);
  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(raw ?? '');
  } catch {
    /* falls through to the 400 */
  }
  if (!body || typeof body !== 'object' || !isKey(body.tab as string)) return fail(400, 'Bad request.');
  if (typeof body.mode !== 'string' || !SAFE_ID.test(body.mode)) return fail(400, 'Bad request.');
  const playlist = typeof body.playlist === 'string' && SAFE_ID.test(body.playlist) ? body.playlist : null;

  // Coarse buckets from the request itself (server/ua.ts); the header is not kept.
  const client = classify(request.headers.get('User-Agent'), { brave: body.brave === true, touch: body.touch === true });
  if (client.device === 'bot') return new Response(null, { status: 204 });

  // A linked account (migrations/0009_account_activity.sql): the tab sends
  // its device key when the visitor has a cloud copy and leaves "Link my
  // activity" on. No key, an unknown one, or a cloud copy from before Google
  // sign-in (not signed in, so /privacy promises anonymous): anonymous.
  const who = typeof body.key === 'string' ? await memberForKey(env, body.key) : null;

  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const writes = [
    // Listening time: what this tab was playing since its last ping (about a
    // minute ago) is credited to that mode, playlist and song — read from the
    // row before it is overwritten below. A tab silent for longer than
    // CREDIT_MS (closed without a final ping) gets nothing for the gap.
    env.DB.prepare(
      `INSERT INTO listen_daily (day, mode, mode_name, playlist, playlist_name, track, ms)
       SELECT ?1, mode, mode_name, COALESCE(playlist, ''), playlist_name, COALESCE(track, ''), ?2 - seen_at
       FROM listeners WHERE tab = ?3 AND playing = 1 AND seen_at > ?2 - ?4
       ON CONFLICT (day, mode, playlist, track) DO UPDATE SET ms = ms + excluded.ms,
         mode_name = excluded.mode_name, playlist_name = excluded.playlist_name`,
    ).bind(day, now, body.tab, CREDIT_MS),
    // The same minutes for the account the tab belonged to at its last ping, if any.
    env.DB.prepare(
      `INSERT INTO profile_listens (profile_id, day, mode, mode_name, playlist, playlist_name, track, ms)
       SELECT profile_id, ?1, mode, mode_name, COALESCE(playlist, ''), playlist_name, COALESCE(track, ''), ?2 - seen_at
       FROM listeners WHERE tab = ?3 AND playing = 1 AND seen_at > ?2 - ?4 AND profile_id IS NOT NULL
         -- A profile deleted since the last ping: its id would break the foreign
         -- key, failing this whole batch on every ping from the tab until swept.
         AND EXISTS (SELECT 1 FROM profiles WHERE id = listeners.profile_id)
       ON CONFLICT (profile_id, day, mode, playlist, track) DO UPDATE SET ms = ms + excluded.ms,
         mode_name = excluded.mode_name, playlist_name = excluded.playlist_name`,
    ).bind(day, now, body.tab, CREDIT_MS),
    env.DB.prepare(
      `INSERT INTO listeners (tab, mode, mode_name, playlist, playlist_name, track, playing, seen_at,
         browser, os, device, country, profile_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (tab) DO UPDATE SET mode = excluded.mode, mode_name = excluded.mode_name,
         playlist = excluded.playlist, playlist_name = excluded.playlist_name, track = excluded.track,
         playing = excluded.playing, seen_at = excluded.seen_at, browser = excluded.browser,
         os = excluded.os, device = excluded.device, country = excluded.country,
         profile_id = excluded.profile_id`,
    ).bind(
      body.tab,
      body.mode,
      text(body.modeName, 60),
      playlist,
      text(body.playlistName, 80),
      text(body.track, 200),
      body.playing === true ? 1 : 0,
      now,
      client.browser,
      client.os,
      client.device,
      countryOf(request),
      who?.profileId ?? null,
    ),
  ];
  if (Math.random() < SWEEP_ODDS) {
    writes.push(env.DB.prepare('DELETE FROM listeners WHERE seen_at < ?').bind(now - KEEP_MS));
  }
  await env.DB.batch(writes);
  return new Response(null, { status: 204 });
};
