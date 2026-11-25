/*
 * Which browser, system and kind of device a request comes from — coarse
 * buckets for the owner's admin page, worked out here from the User-Agent
 * header so the browser sends nothing for it. The header itself is never
 * stored: only these buckets, and only as anonymous counts.
 *
 * Hand-written on purpose: the usual library (ua-parser-js v2) is AGPL. A
 * handful of patterns covers the browsers people actually use; the rest
 * land in "Other", which is fine for counts. Order matters — Edge, Opera and
 * Samsung say "Chrome" too, Chrome on iOS says "Safari", Android says "Linux".
 */

export interface Client {
  browser: string;
  os: string;
  device: 'mobile' | 'tablet' | 'desktop' | 'bot';
}

/** What only the page can tell: Brave hides in its User-Agent, and an iPad asks for desktop sites. */
export interface Hints {
  brave?: boolean;
  touch?: boolean;
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera|OPX\//, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/YaBrowser\//, 'Yandex'],
  [/Vivaldi\//, 'Vivaldi'],
  [/UCBrowser\//, 'UC Browser'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/CriOS\/|Chrome\/|Chromium\//, 'Chrome'],
  [/Version\/[\d.]+.*Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/Windows NT|Windows Phone/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/CrOS/, 'ChromeOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux|X11/, 'Linux'],
];

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|fetch|curl|wget|python|node-fetch|axios/i;

export function classify(userAgent: string | null, hints: Hints = {}): Client {
  const ua = userAgent ?? '';
  let browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? 'Other';
  let os = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? 'Other';
  // Brave says it is Chrome; only the page (navigator.brave) can tell.
  if (hints.brave === true && browser === 'Chrome') browser = 'Brave';

  let device: Client['device'];
  if (!ua || BOT.test(ua)) device = 'bot';
  else if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device = 'tablet';
  else if (/Mobi|iPhone|iPod|Android/.test(ua)) device = 'mobile';
  else device = 'desktop';

  // An iPad in desktop mode says "Macintosh"; a Mac has no touch screen.
  if (os === 'macOS' && hints.touch === true && device === 'desktop') {
    os = 'iOS';
    device = 'tablet';
  }
  return { browser, os, device };
}

/** Two-letter country Cloudflare puts on every request ('XX' unknown, 'T1' Tor), or 'XX'. */
export function countryOf(request: Request): string {
  const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  return typeof country === 'string' && /^[A-Z][A-Z0-9]$/.test(country) ? country : 'XX';
}
