import { useEffect, useState } from 'react';
import { useVibe } from '@/state/vibe-context';
import { useStatsChoice } from '@/hooks/useStatsChoice';
import { counting, setStatsChoice } from '@/utils/analytics';

/** Seconds inside a mode before asking: the question shouldn't be the first thing a visitor meets. */
const ASK_AFTER_MS = 15_000;

/**
 * "Allow anonymous stats?" — asked once per browser, only where counting is on
 * at all (not under Global Privacy Control, not in development). Yes makes a
 * random id that lets the admin page tell returning visitors from new ones
 * (src/utils/analytics.ts, migrations/0012_insights.sql); no, or no answer,
 * makes nothing. Changeable any time in Settings → Usage counts.
 *
 * A small card above the player, never a modal: the site stays usable while
 * it waits, and the fixed position keeps the one-screen layout untouched.
 */
export function StatsConsent() {
  const { hasEntered } = useVibe();
  const choice = useStatsChoice();
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (!hasEntered || choice !== null || !counting()) return;
    const timer = window.setTimeout(() => setDue(true), ASK_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [hasEntered, choice]);

  if (!due || choice !== null || !hasEntered) return null;

  return (
    <section
      aria-label="Anonymous stats"
      className="vm-panel fixed z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-4 shadow-xl shadow-black/40"
      style={{ bottom: 'calc(var(--player-height) + 16px)', right: 'calc(1rem + var(--safe-right))' }}
    >
      <p className="text-sm font-semibold text-ink">Help improve Vibe Mode?</p>
      <p className="mt-1 text-xs text-muted">
        Let this browser be remembered — by a random id, with no name and no IP — so the site’s owner can see how many
        people come back.{' '}
        <a className="underline hover:text-ink" href="/privacy" target="_blank" rel="noopener">
          Privacy
        </a>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="vm-tap rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-canvas transition-[filter] hover:brightness-110"
          onClick={() => setStatsChoice('yes')}
        >
          Allow
        </button>
        <button
          type="button"
          className="vm-tap rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:border-primary/50"
          onClick={() => setStatsChoice('no')}
        >
          No thanks
        </button>
      </div>
    </section>
  );
}
