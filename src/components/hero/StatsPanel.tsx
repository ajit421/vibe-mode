import { motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';

/**
 * The little readout panel — `PROPER SOLUTIONS 00`, `CHAI LEVEL ████████░░`.
 * Entirely driven by `theme.stats`, so a new mode gets one for free.
 */
export function StatsPanel() {
  const { theme, preferences, motionEnabled } = useVibe();
  const stats = theme.stats ?? [];

  if (!preferences.hud || !stats.length) return null;

  return (
    // No panel chrome of its own — it sits inside one now, and a panel nested
    // in a panel reads as a widget dropped into the page. Desktop only: these
    // rows are the first thing a narrow screen has no room for.
    <dl className="hidden gap-2.5 border-t border-line/50 pt-4 lg:grid">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          className="flex items-center gap-3"
          initial={motionEnabled ? { opacity: 0, x: -8 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 + index * 0.05, duration: 0.3 }}
        >
          <dt className="vm-label flex-1 text-muted">{stat.label}</dt>

          {stat.meter === undefined ? (
            <dd className="font-mono text-sm font-medium text-ink tabular-nums">{stat.value}</dd>
          ) : (
            <dd className="flex items-center gap-2.5">
              <span className="flex gap-[3px]" aria-hidden="true">
                {Array.from({ length: 10 }, (_, cell) => (
                  <motion.span
                    key={cell}
                    className="h-3 w-[5px] rounded-[1px]"
                    style={{
                      background:
                        cell < Math.round(stat.meter! * 10)
                          ? 'var(--c-primary)'
                          : 'color-mix(in oklab, var(--c-border) 90%, transparent)',
                    }}
                    initial={motionEnabled ? { scaleY: 0.2, opacity: 0.4 } : false}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ delay: 0.18 + index * 0.05 + cell * 0.02, duration: 0.24 }}
                  />
                ))}
              </span>
              <span className="w-24 text-right font-mono text-xs text-muted">{stat.value}</span>
            </dd>
          )}
        </motion.div>
      ))}
    </dl>
  );
}
