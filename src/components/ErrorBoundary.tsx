import { Component, type ErrorInfo, type ReactNode } from 'react';
import { downloadJson, storedBackup } from '@/utils/backup';
import { clearStoredPreferences } from '@/utils/storage';
import { SYNC_STORAGE_KEY } from '@/sync/sync';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence. A broken theme config or a scene that throws should
 * cost you the page, not leave a white screen with no way out — so the
 * fallback offers a reset that clears the stored mode.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep this — it is the only breadcrumb when something fails in production.
    console.error('Vibe Mode crashed:', error, info.componentStack);
  }

  /**
   * Starting over wipes what this site saved — which, now that visitors build
   * their own modes and upload pictures, can be hours of their work. So it is
   * saved to a file first (the same file "Restore from file" takes), and only
   * this site's keys are cleared, never the whole of localStorage.
   */
  private reset = () => {
    try {
      downloadJson(storedBackup(), 'vibe-mode-backup.json');
    } catch {
      /* storage or downloads blocked — nothing to save, carry on */
    }
    clearStoredPreferences();
    // Forget the cloud copy's key too, or the next load would fetch back the
    // very data that may have caused the crash. It is in the downloaded file.
    try {
      window.localStorage.removeItem(SYNC_STORAGE_KEY);
    } catch {
      /* storage blocked */
    }
    // A beat before navigating, so the download isn't cut off by the unload.
    window.setTimeout(() => {
      window.location.href = window.location.pathname;
    }, 800);
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
        <div className="max-w-md">
          <p className="vm-label text-primary">Something broke</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-ink">
            Arre. Ye toh chalna chahiye tha.
          </h1>
          <p className="mt-3 text-sm text-muted">
            The site hit an error it could not recover from. Starting fresh usually sorts it out —
            your modes and settings are saved to a file first, so you can bring them back from
            Customize → Backup.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface p-3 text-left font-mono text-[0.7rem] text-muted">
            {error.message}
          </pre>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-primary/60"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.reset}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-canvas transition-[filter] hover:brightness-110"
            >
              Save a backup, then start over
            </button>
          </div>
        </div>
      </div>
    );
  }
}
