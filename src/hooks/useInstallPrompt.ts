import { useSyncExternalStore } from 'react';
import { track } from '@/utils/analytics';

/**
 * "Install as an app", offered only where the browser can actually do it.
 *
 * Two routes, newest first: `navigator.install()` (the Web Install API), and
 * Chromium's `beforeinstallprompt`, which fires once the page qualifies and
 * has to be caught and held until the visitor asks. Firefox and Safari have
 * neither — there `canInstall` stays false and no button is shown, which is
 * better than a button that does nothing. Their own browser menus still work.
 *
 * The listener is attached when this module first loads (the Settings panel is
 * in the main bundle), so the one-shot event isn't missed while the panel is
 * closed.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallableNavigator = Navigator & { install?: () => Promise<void> };

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const hasWebInstall = (): boolean =>
  typeof navigator !== 'undefined' &&
  typeof (navigator as InstallableNavigator).install === 'function';

const isInstalled = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): boolean => !isInstalled() && (hasWebInstall() || deferred !== null);

export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(subscribe, getSnapshot, () => false);

  // Must be called straight from the click handler: both routes need the
  // click's "user activation", which a delayed call loses.
  const install = async () => {
    try {
      if (hasWebInstall()) {
        await (navigator as InstallableNavigator).install?.();
        track('install', 'accepted');
        return;
      }
      // Single-use: drop it before awaiting so a second click can't reuse it.
      const prompt = deferred;
      deferred = null;
      notify();
      if (!prompt) return;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      track('install', outcome);
    } catch (error) {
      // Cancelling is a normal choice, not an error worth reporting.
      if (!(error instanceof DOMException && error.name === 'AbortError')) console.error(error);
    }
  };

  return { canInstall, install };
}
