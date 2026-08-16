/**
 * A tiny event bus for theme-specific easter eggs.
 *
 * Keyboard shortcuts live in the app shell, but the animations they trigger
 * belong to whichever scene is on screen. Rather than threading callbacks
 * through the tree for a handful of one-off flourishes, the shell emits and
 * the active visual listens.
 */
export type VibeEventName = 'announce' | 'reroute' | 'tune';

const TARGET_PREFIX = 'vibe:';

export function emitVibeEvent(name: VibeEventName): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(`${TARGET_PREFIX}${name}`));
}

export function subscribeVibeEvent(name: VibeEventName, handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const type = `${TARGET_PREFIX}${name}`;
  window.addEventListener(type, handler);
  return () => window.removeEventListener(type, handler);
}
