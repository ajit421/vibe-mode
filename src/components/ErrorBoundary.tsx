import { Component, type ErrorInfo, type ReactNode } from 'react';

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

  private reset = () => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.href = window.location.pathname;
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
            The site hit an error it could not recover from. Starting fresh usually sorts it out.
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
              Reset and start over
            </button>
          </div>
        </div>
      </div>
    );
  }
}
