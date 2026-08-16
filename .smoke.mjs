/**
 * Headless smoke test: bundles the real app, mounts it in a DOM, drives it
 * through the landing screen into each mode, and reports any console errors.
 */
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = 'd:/Code/Jugaad_House';
const OUT = resolve(process.env.SCRATCH ?? '.', 'app.bundle.js');

await build({
  entryPoints: [resolve(ROOT, 'src/main.tsx')],
  bundle: true,
  format: 'iife',
  outfile: OUT,
  jsx: 'automatic',
  target: 'es2020',
  loader: { '.css': 'empty' },
  alias: { '@': resolve(ROOT, 'src') },
  define: {
    'process.env.NODE_ENV': '"development"',
    'import.meta.env': '{}',
  },
  logLevel: 'error',
});

const errors = [];
const warnings = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('error', (...args) => errors.push(args.join(' ')));
virtualConsole.on('warn', (...args) => warnings.push(args.join(' ')));
virtualConsole.on('jsdomError', (error) => errors.push(`jsdomError: ${error.message}`));

const dom = new JSDOM(
  `<!doctype html><html lang="en"><head>
     <meta name="theme-color" content="#000">
     <meta name="description" content="">
   </head><body><div id="root"></div></body></html>`,
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://vibe.test/', virtualConsole },
);

const { window } = dom;

// Browser APIs jsdom does not implement.
window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
});
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.scrollTo = () => {};
Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} } });

// Stop the real YouTube script from being requested, and fake the API so the
// player path is exercised rather than skipped.
const realCreate = window.document.createElement.bind(window.document);
window.document.createElement = (tag, options) => {
  const element = realCreate(tag, options);
  if (String(tag).toLowerCase() === 'script') {
    setTimeout(() => {
      window.YT = {
        PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
        Player: function Player(el, config) {
          const api = {
            playVideo() {},
            pauseVideo() {},
            stopVideo() {},
            nextVideo() {},
            previousVideo() {},
            playVideoAt() {},
            mute() {},
            unMute() {},
            isMuted: () => false,
            setVolume() {},
            getVolume: () => 70,
            seekTo() {},
            getCurrentTime: () => 12,
            getDuration: () => 200,
            getPlayerState: () => 5,
            getVideoData: () => ({ video_id: 'abc12345678', title: 'Test Track (Official Video)', author: 'Someone' }),
            getVideoUrl: () => 'https://youtube.com/watch?v=abc12345678',
            getPlaylist: () => ['a', 'b', 'c'],
            getPlaylistIndex: () => 0,
            loadPlaylist() {},
            cuePlaylist() {},
            setShuffle() {},
            setLoop() {},
            destroy() {},
          };
          const iframe = realCreate('iframe');
          el.replaceWith(iframe);
          setTimeout(() => config?.events?.onReady?.({ target: api, data: 5 }), 0);
          return api;
        },
      };
      window.onYouTubeIframeAPIReady?.();
    }, 0);
  }
  return element;
};

window.eval(readFileSync(OUT, 'utf8'));

const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const text = () => window.document.body.textContent ?? '';
const results = [];
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? ` — ${detail}` : ''}`);

await tick(200);

check('app mounts', window.document.querySelector('#root')?.children.length > 0);
check('landing question renders', text().includes('Where are you'));
check('all five modes listed', ['Judaad House', 'Metro Mode', 'Indian Train', 'Cab Wala', 'Office Mode'].every((n) => text().includes(n)));
check('document title is the landing title', window.document.title.includes('Where are you right now'));

// Enter a mode with the keyboard shortcut.
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '2', bubbles: true }));
await tick(1400);

check('metro world entered', text().includes('METRO MODE'), text().slice(0, 200));
check('metro kicker present', text().includes('NEXT STATION: VIBE'));
check('metro scene loaded (route map)', text().includes('NOSTALGIA'));
check('theme css var applied', window.document.documentElement.style.getPropertyValue('--c-primary') === '#38bdf8');
check('data-theme set', window.document.documentElement.dataset.theme === 'metro');
check('url reflects mode', window.location.search.includes('mode=metro'));
check('document title follows theme', window.document.title.includes('Metro Mode'));
check('player shows unconfigured state', text().includes('Playlist not set up yet'));
check('playlist chips render', text().includes('Metro Vibes') && text().includes('Rush Hour Escape'));

// Metro easter egg.
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
await tick(120);
check('metro announcement toast', text().includes('Doors closing'));

// Switch worlds.
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', bubbles: true }));
await tick(1400);
check('judaad house entered', text().includes('JUDAAD HOUSE'));
check('judaad scene loaded', text().includes('PROPER SOLUTIONS'));
check('judaad stats meter', text().includes('CHAI LEVEL'));
check('theme colour swapped', window.document.documentElement.style.getPropertyValue('--c-primary') === '#f5a524');

window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '3', bubbles: true }));
await tick(1200);
check('train entered', text().includes('WINDOW SEAT') && text().includes('12951'));

window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '4', bubbles: true }));
await tick(1200);
check('cab entered', text().includes('CAB WALA') && text().includes('ETA'));

window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '5', bubbles: true }));
await tick(1200);
check('office entered', text().includes('OFFICE MODE') && text().includes('monday.ts'));

// Shortcuts + settings dialogs.
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '?', bubbles: true }));
await tick(150);
check('shortcuts dialog opens', text().includes('Keyboard shortcuts') && text().includes('Play / pause'));
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await tick(200);
check('shortcuts dialog closes', !text().includes('Play / pause'));

const settingsButton = [...window.document.querySelectorAll('button')].find(
  (b) => b.getAttribute('aria-label') === 'Settings',
);
settingsButton?.click();
await tick(200);
check('settings dialog opens', text().includes('Ambient effects') && text().includes('YouTube playlist ID'));

// Paste a playlist URL and apply it.
const input = window.document.querySelector('#playlist-override');
if (input) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'https://www.youtube.com/playlist?list=PLtestPlaylist1234');
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  [...window.document.querySelectorAll('button')]
    .find((b) => b.textContent?.trim() === 'Apply')
    ?.click();
}
await tick(400);
check('override accepted', text().includes('PLtestPlaylist1234'));
check(
  'localStorage persisted override',
  (window.localStorage.getItem('vibe-mode.playlistOverrides') ?? '').includes('PLtestPlaylist1234'),
);

window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await tick(600);
check('player picks up configured playlist', !text().includes('Playlist not set up yet'), text().slice(-400));

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);

const ignorable = (line) =>
  line.includes('Not implemented: HTMLMediaElement') || line.includes('Could not parse CSS');
const realErrors = errors.filter((line) => !ignorable(line));
console.log(`\nconsole.error: ${realErrors.length}`);
realErrors.slice(0, 12).forEach((line) => console.log('  ✗ ' + line.slice(0, 400)));
const realWarnings = warnings.filter((line) => !ignorable(line));
console.log(`console.warn: ${realWarnings.length}`);
realWarnings.slice(0, 12).forEach((line) => console.log('  ! ' + line.slice(0, 300)));

process.exit(results.some((r) => r.startsWith('FAIL')) || realErrors.length ? 1 : 0);
