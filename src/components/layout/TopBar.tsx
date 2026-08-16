import { CircleHelp, Settings2, Shuffle } from 'lucide-react';
import { useVibe } from '@/state/vibe-context';
import { IconButton } from '@/components/ui/IconButton';

interface TopBarProps {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="size-7 shrink-0" aria-hidden="true">
        <path
          d="M32 9c-9.4 0-17 7.4-17 16.6 0 11.9 14.4 26.3 15.9 27.8a1.6 1.6 0 0 0 2.2 0C34.6 51.9 49 37.5 49 25.6 49 16.4 41.4 9 32 9Z"
          fill="var(--c-primary)"
        />
        <circle cx="32" cy="25.5" r="10" fill="var(--c-background)" />
        <path d="M28.6 20.2 38 25.5l-9.4 5.3V20.2Z" fill="var(--c-text)" />
      </svg>
      <span className="font-display text-sm font-semibold tracking-[0.22em] text-ink uppercase">
        Vibe Mode
      </span>
    </span>
  );
}

export function TopBar({ onOpenSettings, onOpenShortcuts }: TopBarProps) {
  const { theme, hasEntered, setSelectorOpen, leaveToLanding } = useVibe();
  const Icon = theme.icon;

  return (
    // Insets live on the header so the inner row keeps its responsive padding
    // and simply starts below the notch / inside the rounded corners.
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        paddingTop: 'var(--safe-top)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}
    >
      {/* Scrim so page content scrolling underneath never collides with the
          wordmark or the controls. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-canvas via-canvas/85 to-transparent"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <button
          type="button"
          onClick={leaveToLanding}
          className="rounded-lg transition-opacity hover:opacity-80"
          aria-label="Vibe Mode — back to the mode picker"
        >
          <Wordmark />
        </button>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {hasEntered && (
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              // Both labels below are hidden on small screens, which would
              // leave this as an unnamed icon-only button on a phone.
              aria-label={`Change vibe — currently ${theme.name}`}
              className="vm-panel group flex items-center gap-2 rounded-full py-1.5 pr-2.5 pl-3 transition-colors hover:border-primary/50"
            >
              <Icon className="size-3.5 text-primary" />
              <span className="hidden text-xs font-medium text-ink sm:inline">
                {theme.shortName}
              </span>
              <span className="vm-label hidden text-[0.6rem] text-muted md:inline">
                change vibe
              </span>
              <Shuffle className="size-3.5 text-muted transition-colors group-hover:text-primary" />
            </button>
          )}

          <IconButton label="Keyboard shortcuts" size="sm" onClick={onOpenShortcuts}>
            <CircleHelp />
          </IconButton>
          <IconButton label="Settings" size="sm" onClick={onOpenSettings}>
            <Settings2 />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
