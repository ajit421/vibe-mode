import { CircleHelp, Settings2, Shuffle } from 'lucide-react';
import { useVibe } from '@/state/vibe-context';
import { useClock } from '@/hooks/useClock';
import { IconButton } from '@/components/ui/IconButton';

// Built once, not per render — constructing an Intl formatter is expensive and
// this one repaints every second.
const TIME = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const DATE = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

interface TopBarProps {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

export function TopBar({ onOpenSettings, onOpenShortcuts }: TopBarProps) {
  const { theme, hasEntered, setSelectorOpen, leaveToLanding } = useVibe();
  const Icon = theme.icon;
  // Ticks once a minute: the readout has no seconds, so a 1s interval would be
  // fifty-nine wasted renders. `useClock` stops entirely on a hidden tab.
  const now = useClock(30_000);

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
      {/* Scrim so the scene never collides with the title or the controls. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-canvas via-canvas/80 to-transparent"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-[1600px] items-start gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        {/* The mode's name is the page title, so it is the `h1` and it is set
            at title size. The old lockup sat here saying the product's name
            instead, which told a visitor already inside a mode nothing. */}
        {hasEntered && (
          <button
            type="button"
            onClick={leaveToLanding}
            className="min-w-0 rounded-lg text-left transition-opacity hover:opacity-80"
            aria-label={`${theme.name} — back to all modes`}
          >
            {/* The mode's status line lives up here with the name it belongs
                to, rather than down in the panel. Truncated rather than
                wrapped — it must stay one line beside the title. */}
            <span className="vm-label block truncate text-[0.6rem] text-primary/85">
              {theme.hero.kicker}
            </span>
            <h1 className="vm-glow-text truncate font-display text-[clamp(1.75rem,4.6vw,3.5rem)] leading-none font-bold tracking-tight text-ink uppercase">
              {theme.name}
            </h1>
          </button>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Date and time, always on — not behind the status-readout toggle.
              The strip that toggle controls is a decorative block down in the
              layout; this is the one fact you actually glance up for. The date
              drops out before the time on a narrow screen. */}
          <div className="vm-panel flex items-baseline gap-2 rounded-full px-3 py-1.5">
            <time
              dateTime={now.toISOString()}
              className="font-mono text-xs font-medium text-ink tabular-nums"
            >
              {TIME.format(now)}
            </time>
            <span className="vm-label hidden text-[0.6rem] text-muted sm:inline">
              {DATE.format(now)}
            </span>
          </div>

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
