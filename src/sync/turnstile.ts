/*
 * Cloudflare Turnstile, loaded only when the server asks for it: the very
 * first save from a new browser, and only once the site owner has set the
 * TURNSTILE_* variables. Most visitors never see anything — the check runs
 * invisibly; when it does need a click, a small box appears at the bottom.
 */

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance?: 'always' | 'execute' | 'interaction-only';
      callback: (token: string) => void;
      'error-callback': () => void;
      'timeout-callback'?: () => void;
    },
  ): string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) return resolve(window.turnstile);
      loading = null; // let the next try fetch it again
      reject(new Error('The check didn’t load.'));
    };
    script.onerror = () => {
      // Drop the failed tag so the next try fetches it again.
      script.remove();
      loading = null;
      reject(new Error('Could not load the check.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** A Turnstile token for `siteKey`, or null if the check could not be passed. */
export async function turnstileToken(siteKey: string): Promise<string | null> {
  try {
    const turnstile = await loadTurnstile();
    return await new Promise<string | null>((resolve) => {
      // Fixed to the bottom edge, so it never pushes the one-screen layout.
      const box = document.createElement('div');
      box.style.cssText =
        'position:fixed;left:50%;bottom:calc(var(--safe-bottom, 0px) + 1rem);transform:translateX(-50%);z-index:80';
      // Inside an open panel when there is one: a modal <dialog> makes the
      // rest of the page inert, and the first save usually happens while
      // Customize is open — a box behind it could never be clicked.
      (document.querySelector('dialog[open]') ?? document.body).appendChild(box);
      const done = (token: string | null) => {
        box.remove();
        resolve(token);
      };
      turnstile.render(box, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback: (token) => done(token),
        'error-callback': () => done(null),
        'timeout-callback': () => done(null),
      });
    });
  } catch {
    return null;
  }
}
