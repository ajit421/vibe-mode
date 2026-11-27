import { isSyncKey, newSyncKey, readRecord } from '@/sync/sync';
import { readStorage, STORAGE_KEYS, writeStorage } from '@/utils/storage';

/*
 * Anonymous usage counts for the owner's admin page — the client half of
 * functions/api/{visit,listen,session}.ts. The Settings panel tells visitors
 * what is sent; keep that note true when adding anything here.
 *
 *  - `track(name, detail)` counts a feature use ('panel', 'Customize'). It
 *    only bumps a number in memory: the counts go out in a batch with the
 *    session report, so a click costs no request of its own.
 *  - The session report (`report()`) carries how long this tab has been
 *    open, on screen and playing music, and is sent with sendBeacon whenever
 *    the tab is hidden or closed (src/components/Analytics.tsx wires that).
 *
 * For a visitor without a cloud copy, nothing names a person: the only id is
 * random, lives in this tab's sessionStorage, and is never the device key.
 * A visitor WITH a cloud copy who leaves Settings → "Link my activity to my
 * account" on (the default) also sends their device key, so the server can
 * note the visit, listening and features against their profile for the
 * owner's admin page (migrations/0009_account_activity.sql). Settings and
 * /privacy say so. Counting is off in development (`npm run dev` proxies /api
 * to the live site) and in browsers that send Global Privacy Control — then
 * every function here does nothing.
 */

export const counting = (): boolean => notCountedBecause() === null;

/**
 * Why this browser sends nothing, or null when it is counted — shown in
 * Settings, so a visitor (or the owner testing on a phone) can see it instead
 * of wondering why /admin shows nobody. Firefox sends Global Privacy Control
 * in private tabs, and in normal ones with "Tell websites not to share or sell
 * my data" on; Brave and DuckDuckGo send it by default.
 */
export function notCountedBecause(): 'development' | 'privacy-signal' | null {
  if (!import.meta.env.PROD) return 'development';
  // The signal is a "no" by default, but the visitor can still say yes for
  // this site: the "Help improve Vibe Mode?" card and the Settings switch ask
  // them too, and only that explicit yes turns counting on here.
  if (sendsPrivacySignal() && statsChoice() !== 'yes') return 'privacy-signal';
  return null;
}

/** Global Privacy Control: Firefox private tabs (or with the setting on), Brave and DuckDuckGo by default. */
export const sendsPrivacySignal = (): boolean =>
  Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);

/* ── Returning visitors: only with the visitor's yes ─────────────────────── */

export type StatsChoice = 'yes' | 'no' | null;
const choiceListeners = new Set<() => void>();

/** The visitor's answer to "Allow anonymous stats?" in this browser; null = not asked yet. */
export function statsChoice(): StatsChoice {
  const value = readStorage<string>(STORAGE_KEYS.statsChoice, '');
  return value === 'yes' || value === 'no' ? value : null;
}

/** Records the answer. A 'no' also forgets the id, so this browser is a stranger again. */
export function setStatsChoice(choice: 'yes' | 'no'): void {
  writeStorage(STORAGE_KEYS.statsChoice, choice);
  if (choice === 'no') {
    try {
      localStorage.removeItem(STORAGE_KEYS.visitor);
    } catch {
      /* storage blocked: there was no id to forget */
    }
  }
  for (const listener of choiceListeners) listener();
}

/** For the consent card and the Settings switch, so answering in one updates the other. */
export function onStatsChoice(listener: () => void): () => void {
  choiceListeners.add(listener);
  return () => choiceListeners.delete(listener);
}

/** The random id that tells a returning browser from a new one — made only after a yes. */
function visitorId(): string | null {
  if (statsChoice() !== 'yes') return null;
  let id = readStorage<string>(STORAGE_KEYS.visitor, '');
  if (!isSyncKey(id)) {
    id = newSyncKey();
    writeStorage(STORAGE_KEYS.visitor, id);
  }
  return id;
}

/* ── Page speed ─────────────────────────────────────────────────────────── */

/** Largest Contentful Paint, as the browser reports it (the last candidate wins). */
let lcpMs: number | null = null;
try {
  if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) lcpMs = Math.round(last.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  }
} catch {
  /* no LCP in this browser (Safari before 18): load time alone is sent */
}

/** How long the page took to load, from the browser's own navigation timing; null until it has loaded. */
function loadMs(): number | null {
  const nav = typeof performance !== 'undefined' ? (performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined) : undefined;
  return nav && nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null;
}

/** Set when a report never reached the site while online — almost always an ad or tracker blocker. */
let blocked = false;
export const noteFailedReport = (): void => {
  if (navigator.onLine) blocked = true;
};
export const reportsBlocked = (): boolean => blocked;

/**
 * What only the page knows (server/ua.ts reads the rest from the request):
 * Brave calls itself Chrome, and an iPad asking for desktop sites calls itself a Mac.
 */
export const hints = () => ({ brave: 'brave' in navigator, touch: navigator.maxTouchPoints > 1 });

const TAB_KEY = 'vibe-mode.tab';
let tab: string | null = null;

/** Mirrors the "Link my activity" preference (set by src/components/Analytics.tsx). */
let linking = true;
export function setLinking(on: boolean): void {
  linking = on;
}

/**
 * This browser's device key, when its activity may be linked to its account:
 * it has a cloud copy, cloud save isn't off, and the visitor hasn't switched
 * linking off. Otherwise null, and reports stay anonymous.
 */
export function accountKey(): string | null {
  if (!linking) return null;
  const record = readRecord();
  return record.off ? null : record.key;
}

/** A random id for this tab only, so its reports update one row instead of adding many. */
export function tabId(): string {
  if (tab) return tab;
  try {
    tab = sessionStorage.getItem(TAB_KEY);
    if (!tab) sessionStorage.setItem(TAB_KEY, (tab = newSyncKey()));
  } catch {
    tab = newSyncKey(); // storage blocked: one id for as long as the page lives
  }
  return tab;
}

/* ── Feature counts ─────────────────────────────────────────────────────── */

/** Names the server accepts: functions/api/session.ts. */
const NAME = /^[a-z][a-z0-9_]{0,31}$/;
/** More distinct counts than one report carries are kept for the next. */
const MAX_PER_REPORT = 60;
const counts = new Map<string, { name: string; detail: string; n: number }>();

/** Counts one use of a feature. Cheap and safe to call anywhere — never throws. */
export function track(name: string, detail = ''): void {
  if (!NAME.test(name) || !counting()) return;
  const short = detail.slice(0, 60);
  const key = `${name}\u0000${short}`;
  const entry = counts.get(key);
  if (entry) entry.n += 1;
  else counts.set(key, { name, detail: short, n: 1 });
}

/* ── Session timing ─────────────────────────────────────────────────────── */

const session = {
  start: Date.now(),
  visibleMs: 0,
  visibleSince: typeof document !== 'undefined' && document.visibilityState === 'visible' ? Date.now() : null,
  listenedMs: 0,
  playingSince: null as number | null,
  firstMode: null as string | null,
};

/** Called as the tab shows or hides. */
export function setVisible(visible: boolean, now = Date.now()): void {
  if (visible && session.visibleSince === null) session.visibleSince = now;
  if (!visible && session.visibleSince !== null) {
    session.visibleMs += now - session.visibleSince;
    session.visibleSince = null;
  }
}

/** Called as music starts or stops. */
export function setPlaying(playing: boolean, now = Date.now()): void {
  if (playing && session.playingSince === null) session.playingSince = now;
  if (!playing && session.playingSince !== null) {
    session.listenedMs += now - session.playingSince;
    session.playingSince = null;
  }
}

/** The first mode this tab showed — where visits land. */
export function noteMode(mode: string): void {
  session.firstMode ??= mode;
}

/** What a report says now: totals for the visit so far, and the counts since the last report. */
export function snapshot(now = Date.now()) {
  const events = [...counts.values()].slice(0, MAX_PER_REPORT);
  return {
    tab: tabId(),
    openMs: now - session.start,
    visibleMs: session.visibleMs + (session.visibleSince === null ? 0 : now - session.visibleSince),
    listenedMs: session.listenedMs + (session.playingSince === null ? 0 : now - session.playingSince),
    firstMode: session.firstMode,
    events,
    loadMs: loadMs(),
    lcpMs,
    visitor: visitorId(),
    key: accountKey(),
    ...hints(),
  };
}

/**
 * Sends the session report. sendBeacon, because it still goes out while the
 * tab is being hidden or closed, when an ordinary fetch is often cut off.
 */
export function report(): void {
  if (!counting()) return;
  const body = snapshot();
  const sent = navigator.sendBeacon?.('/api/session', new Blob([JSON.stringify(body)], { type: 'application/json' }));
  // Queued: these counts are on their way. Not queued: kept for the next report.
  if (sent) for (const event of body.events) counts.delete(`${event.name}\u0000${event.detail}`);
}
