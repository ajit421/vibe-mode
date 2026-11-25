import type { VibeBackup } from '@/state/vibe-context';
import { STORAGE_KEYS, readStorage } from './storage';
import { track } from './analytics';

/** Hands the visitor a JSON file to keep. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // The kind of file, never its name: a shared mode's file is named after the mode.
  track('download', filename === 'vibe-mode-settings.json' ? 'settings' : filename === 'vibe-mode-backup.json' ? 'crash backup' : 'shared mode');
  // Revoking in the same tick can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Everything the visitor set, read straight from storage rather than from
 * React state — for the crash screen, where the providers are already gone.
 * The shape matches "Download my settings", so "Restore from file" takes it.
 */
export function storedBackup(): VibeBackup {
  return {
    app: 'vibe-mode',
    version: 1,
    customization: readStorage(STORAGE_KEYS.customization, { edits: {}, added: [], order: [] }),
    preferences: readStorage(STORAGE_KEYS.preferences, {}),
    customPlaylists: readStorage(STORAGE_KEYS.customPlaylists, {}),
    playlistOverrides: readStorage(STORAGE_KEYS.playlistOverrides, {}),
    uploads: readStorage(STORAGE_KEYS.uploads, {}),
  };
}
