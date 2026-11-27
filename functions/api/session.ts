import { isKey, overLimit, memberForKey, readText, type Handler } from '../../server/lib';
import { classify, countryOf } from '../../server/ua';

// One tab's visit, reported by src/components/Analytics.tsx with
// navigator.sendBeacon whenever the tab is hidden or closed: how long it has
// been open, on screen and playing music, plus the features used since the
// last report (migrations/0007_sessions.sql). Anonymous — keyed by the random
// per-tab id — unless the report carries the visitor's device key: a visitor
// with a cloud copy who leaves "Link my activity" on. Then the visit is noted
// against their profile, with the features used in it, for the admin page's
// per-account history (migrations/0009_account_activity.sql). Never an IP.
// Also (migrations/0012_insights.sql): how fast the page loaded, and — only
// when the visitor allowed anonymous stats — a random browser id, kept apart
// from the session with nothing but the days it was seen (returning visitors).
//
// Times are totals for the visit so far and only ever grow, so a repeated
// report changes nothing and a lost one is made good by the next. Feature
// counts are deltas: a lost report loses those few clicks, nothing more.
// Anyone can post here; the numbers are a guide, not a ledger.

const DAY_MS = 86_400_000;
/** No visit is counted as longer than this: a tab left open for a month is still one week. */
const MAX_MS = 7 * DAY_MS;
const MAX_EVENTS = 60;
const EVENT_NAME = /^[a-z][a-z0-9_]{0,31}$/;
/** Sessions are kept this long; daily totals (listen_daily, events_daily) are kept for good. */
const KEEP_DAYS = 90;
const SWEEP_ODDS = 0.05;
/** Distinct features kept per linked visit. */
const MAX_VISIT_EVENTS = 100;

interface Use {
  name: string;
  detail: string;
  n: number;
}

const ms = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(Math.max(value, 0), MAX_MS)) : 0;

const dayOf = (time: number) => new Date(time).toISOString().slice(0, 10);

export const onRequestPost: Handler = async ({ env, request }) => {
  if (overLimit(request, 'session', 150, 10 * 60_000)) return new Response(null, { status: 204 }); // dropped quietly
  let body: Record<string, unknown>;
  try {
    body = JSON.parse((await readText(request, 8_000)) ?? '');
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !isKey(body.tab as string)) return new Response(null, { status: 400 });

  const client = classify(request.headers.get('User-Agent'), { brave: body.brave === true, touch: body.touch === true });
  if (client.device === 'bot') return new Response(null, { status: 204 });

  const now = Date.now();
  const open = ms(body.openMs);
  // On screen and listening can't exceed the time the tab was open.
  const visible = Math.min(ms(body.visibleMs), open);
  const listened = Math.min(ms(body.listenedMs), open);
  const started = now - open;
  const firstMode = typeof body.firstMode === 'string' ? body.firstMode.slice(0, 60) : null;
  // Page speed (migrations/0012_insights.sql): a load past two minutes is a
  // measuring glitch, not a slow page.
  const speed = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 120_000 ? Math.round(value) : null;
  const loadMs = speed(body.loadMs);
  const lcpMs = speed(body.lcpMs);
  // Only present after the visitor said yes to anonymous stats; same shape as a tab id.
  const visitorId = isKey(body.visitor as string) ? (body.visitor as string) : null;

  const uses: Use[] = [];
  for (const event of (Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : []) as Record<string, unknown>[]) {
    if (typeof event?.name !== 'string' || !EVENT_NAME.test(event.name)) continue;
    const n = typeof event.n === 'number' && Number.isInteger(event.n) ? Math.min(Math.max(event.n, 1), 10_000) : 1;
    uses.push({ name: event.name, detail: typeof event.detail === 'string' ? event.detail.trim().slice(0, 60) : '', n });
  }

  // A linked visit keeps its own list of features used: this report's added to
  // what earlier reports from the same tab said. An unlinked one keeps none —
  // switching "Link my activity" off mid-visit unlinks the visit, too.
  const who = typeof body.key === 'string' ? await memberForKey(env, body.key) : null;
  let visitUses: string | null = null;
  if (who) {
    const before = await env.DB.prepare('SELECT events FROM sessions WHERE tab = ? AND profile_id = ?')
      .bind(body.tab, who.profileId)
      .first<string | null>('events');
    const merged = new Map<string, Use>();
    for (const use of [...parseUses(before), ...uses]) {
      const key = `${use.name}\u0000${use.detail}`;
      const known = merged.get(key);
      if (known) known.n += use.n;
      else if (merged.size < MAX_VISIT_EVENTS) merged.set(key, { ...use });
    }
    visitUses = JSON.stringify([...merged.values()]);
  }

  const writes = [
    env.DB.prepare(
      `INSERT INTO sessions (tab, day, started_at, last_at, open_ms, visible_ms, listened_ms, first_mode,
         browser, os, device, country, profile_id, events, load_ms, lcp_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (tab) DO UPDATE SET last_at = excluded.last_at,
         open_ms = MAX(open_ms, excluded.open_ms),
         visible_ms = MAX(visible_ms, excluded.visible_ms),
         listened_ms = MAX(listened_ms, excluded.listened_ms),
         profile_id = excluded.profile_id,
         events = excluded.events,
         load_ms = COALESCE(load_ms, excluded.load_ms),
         lcp_ms = COALESCE(lcp_ms, excluded.lcp_ms)`,
    ).bind(
      body.tab,
      dayOf(started),
      started,
      now,
      open,
      visible,
      listened,
      firstMode,
      client.browser,
      client.os,
      client.device,
      countryOf(request),
      who?.profileId ?? null,
      visitUses,
      loadMs,
      lcpMs,
    ),
  ];

  const today = dayOf(now);
  if (visitorId) {
    // A day counts once however many reports arrive in it; a later day adds one.
    writes.push(
      env.DB.prepare(
        `INSERT INTO visitors (id, first_day, last_day, days) VALUES (?1, ?2, ?2, 1)
         ON CONFLICT (id) DO UPDATE SET days = days + (last_day <> ?2), last_day = MAX(last_day, ?2)`,
      ).bind(visitorId, today),
    );
  }
  for (const use of uses) {
    writes.push(
      env.DB.prepare(
        `INSERT INTO events_daily (day, name, detail, count) VALUES (?, ?, ?, ?)
         ON CONFLICT (day, name, detail) DO UPDATE SET count = count + excluded.count`,
      ).bind(today, use.name, use.detail, use.n),
    );
  }

  if (Math.random() < SWEEP_ODDS) {
    writes.push(env.DB.prepare('DELETE FROM sessions WHERE day < ?').bind(dayOf(now - KEEP_DAYS * DAY_MS)));
    // A browser not seen for over a year is forgotten.
    writes.push(env.DB.prepare('DELETE FROM visitors WHERE last_day < ?').bind(dayOf(now - 400 * DAY_MS)));
  }
  await env.DB.batch(writes);
  return new Response(null, { status: 204 });
};

/** A linked visit's stored feature list; anything unreadable counts as none. */
function parseUses(text: string | null): Use[] {
  try {
    const list = JSON.parse(text ?? '[]');
    return Array.isArray(list)
      ? list.filter((use): use is Use => typeof use?.name === 'string' && typeof use?.n === 'number')
      : [];
  } catch {
    return [];
  }
}
