export interface VibeUrlState {
  mode: string | null;
  playlist: string | null;
}

/** Reads `?mode=…&playlist=…` from the current URL. */
export function readUrlState(): VibeUrlState {
  if (typeof window === 'undefined') return { mode: null, playlist: null };
  const params = new URLSearchParams(window.location.search);
  return {
    mode: params.get('mode'),
    playlist: params.get('playlist'),
  };
}

/**
 * Keeps the address bar in sync without adding history entries — the back
 * button should leave the site, not walk back through every mode you tried.
 */
export function syncUrlState(state: VibeUrlState): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (state.mode) url.searchParams.set('mode', state.mode);
  else url.searchParams.delete('mode');

  if (state.playlist) url.searchParams.set('playlist', state.playlist);
  else url.searchParams.delete('playlist');

  if (url.toString() !== window.location.href) {
    window.history.replaceState(window.history.state, '', url);
  }
}

export function buildShareUrl(state: VibeUrlState): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.origin + window.location.pathname);
  if (state.mode) url.searchParams.set('mode', state.mode);
  if (state.playlist) url.searchParams.set('playlist', state.playlist);
  return url.toString();
}
