import { SAFE_ID, fail, isKey, readText, type Handler } from '../../server/lib';
import { classify, countryOf } from '../../server/ua';

// Anonymous "now playing" (see migrations/0005_listeners.sql and
// src/components/ListenPing.tsx). Open to anyone, like /api/config — it holds
// nothing about a person, only which mode, playlist and song a tab plays.
//
// Cost: one billed request and one D1 write per playing tab per minute, so
// ~70 tabs playing all day use the free 100k/day. Only the shape is checked:
// a script could invent listeners, but only for the few minutes a row counts.

/** How long a row is kept. The admin page counts rows seen in the last 150 s. */
const KEEP_MS = 10 * 60_000;
/** Sweep on 1 ping in 20: the table stays tiny without a full scan on every ping. */
const SWEEP_ODDS = 0.05;

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

export const onRequestPost: Handler = async ({ env, request }) => {
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

  const now = Date.now();
  const writes = [
    env.DB.prepare(
      `INSERT INTO listeners (tab, mode, mode_name, playlist, playlist_name, track, playing, seen_at,
         browser, os, device, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (tab) DO UPDATE SET mode = excluded.mode, mode_name = excluded.mode_name,
         playlist = excluded.playlist, playlist_name = excluded.playlist_name, track = excluded.track,
         playing = excluded.playing, seen_at = excluded.seen_at, browser = excluded.browser,
         os = excluded.os, device = excluded.device, country = excluded.country`,
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
    ),
  ];
  if (Math.random() < SWEEP_ODDS) {
    writes.push(env.DB.prepare('DELETE FROM listeners WHERE seen_at < ?').bind(now - KEEP_MS));
  }
  await env.DB.batch(writes);
  return new Response(null, { status: 204 });
};
