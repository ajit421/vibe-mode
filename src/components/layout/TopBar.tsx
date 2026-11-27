import { CircleHelp, Palette, Settings2, Shuffle, UserRound } from 'lucide-react';
import { useVibe } from '@/state/vibe-context';
import { useClock } from '@/hooks/useClock';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/account/Avatar';
import { useSync } from '@/state/sync-context';

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
  onOpenCustomize: () => void;
  onOpenAccount: () => void;
}

export function TopBar({ onOpenSettings, onOpenShortcuts, onOpenCustomize, onOpenAccount }: TopBarProps) {
  const { account, status } = useSync();
  const { theme, hasEntered, setSelectorOpen, leaveToLanding, preferences } = useVibe();
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
      {/* A light lift under the title and controls — deliberately not the solid
          `from-canvas via-canvas/80` band this used to be. `SceneBackground`
          already lays a gradient across the top, and the two together read as
          a dark bar sitting on the artwork rather than as the artwork simply
          getting out of the way. The title carries `vm-glow-text` and the
          buttons carry `vm-panel`, so both are legible without it. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-canvas/55 via-canvas/18 to-transparent"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-[1600px] items-start gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        {/* The mode's name is the page title, so it is the `h1` and it is set
            at title size. The old lockup sat here saying the product's name
            instead, which told a visitor already inside a mode nothing. */}
        {/* The heading holds the button, not the other way round: a button's
            content is presentational, so an h1 inside one is invalid and
            screen readers found no heading in a mode at all. */}
        {hasEntered && (
          <h1 className="min-w-0">
          <button
            type="button"
            onClick={leaveToLanding}
            // `max-w-full`: a button sizes to its content, and the kicker is
            // `nowrap`, so without a cap the button grew past the h1 and the
            // status line ran under the clock on a phone held sideways
            // instead of truncating.
            className="vm-tap max-w-full min-w-0 rounded-lg text-left transition-opacity hover:opacity-80"
            aria-label={`${theme.name} — back to all modes`}
          >
            {/* The mode's status line lives up here with the name it belongs
                to, rather than down in the panel. Truncated rather than
                wrapped — it must stay one line beside the title. The name
                itself wraps to a second, balanced line on a narrow phone
                instead: a heading cut to "OFFICE MO…" no longer says where
                you are. */}
            <span className="vm-label block truncate text-[0.6875rem] text-primary/85">
              {theme.hero.kicker}
            </span>
            <span className="vm-glow-text line-clamp-2 block text-balance font-display text-[clamp(1.375rem,4.6vw,3.5rem)] leading-none font-bold tracking-tight text-ink uppercase">
              {theme.name}
            </span>
          </button>
          </h1>
        )}

        {/* On the landing screen the top-left is otherwise empty: the
            product's name lives there until you are inside a mode, when the
            mode's own name takes its place. A <p>, not a heading — the
            landing's question is its h1. */}
        {!hasEntered && (
          <p className="flex items-center gap-2 pt-2 font-display text-sm font-bold tracking-[0.18em] text-ink uppercase">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_var(--c-glow)]" aria-hidden="true" />
            Vibe Mode
          </p>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Date and time, always on — not behind the status-readout toggle.
              The strip that toggle controls is a decorative block down in the
              layout; this is the one fact you actually glance up for. The date
              drops out before the time on a narrow screen, and on a phone the
              whole clock does: the phone's own status bar already shows the
              time, and here it squeezed the mode's name down to "OFFI…". */}
          {preferences.clock && (
            <div className="vm-panel hidden items-baseline gap-2 rounded-full px-3 py-1.5 sm:flex">
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
          )}

          {hasEntered && (
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              // Both labels below are hidden on small screens, which would
              // leave this as an unnamed icon-only button on a phone.
              aria-label={`Change vibe — currently ${theme.name}`}
              className="vm-panel vm-tap group flex items-center gap-2 rounded-full py-1.5 pr-2.5 pl-3 transition-colors hover:border-primary/50"
            >
              <Icon className="size-3.5 text-primary" />
              <span className="hidden text-xs font-medium text-primary sm:inline">
                {theme.shortName}
              </span>
              <span className="vm-label hidden text-[0.6rem] text-muted md:inline">
                change vibe
              </span>
              <Shuffle className="size-3.5 text-muted transition-colors group-hover:text-primary" />
            </button>
          )}

          {/* Shortcuts need a keyboard: off on phones, where the bar is tightest. */}
          {/* Frosted like the pills beside them, so they read over a bright
              frame instead of floating as bare glyphs. */}
          <IconButton label="Keyboard shortcuts" size="sm" onClick={onOpenShortcuts} className="vm-panel max-sm:hidden">
            <CircleHelp />
          </IconButton>
          <IconButton label="Customize modes" size="sm" onClick={onOpenCustomize} className="vm-panel">
            <Palette />
          </IconButton>
          <IconButton label="Settings" size="sm" onClick={onOpenSettings} className="vm-panel">
            <Settings2 />
          </IconButton>

          {/* The account: the way into the signed-in (Google) features. Signed
              out it says "Sign in" where there's room; a dot asks a browser
              holding a cloud copy from before Google to sign in and keep it. */}
          <button
            type="button"
            onClick={onOpenAccount}
            aria-label={
              account
                ? `Account — signed in as ${account.email ?? account.name ?? 'Google account'}`
                : 'Account — sign in with Google'
            }
            title={account ? (account.email ?? 'Account') : 'Sign in'}
            className={
              account
                ? 'vm-tap relative ml-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-line transition hover:ring-primary/70'
                : 'vm-panel vm-tap relative ml-0.5 flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-ink transition-colors hover:border-primary/50'
            }
          >
            {account ? (
              <Avatar account={account} className="size-7 text-xs" />
            ) : (
              <>
                <UserRound className="size-4 text-ink/80" aria-hidden="true" />
                <span className="hidden sm:inline">Sign in</span>
              </>
            )}
            {status === 'needs-google' && (
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-canvas" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
