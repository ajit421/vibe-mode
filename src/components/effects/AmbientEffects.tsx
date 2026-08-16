import { memo, type CSSProperties, type ComponentType } from 'react';
import { useVibe } from '@/state/vibe-context';
import type { VibeEffects } from '@/types/theme';

/**
 * Deterministic pseudo-random so particle layouts stay put across renders
 * instead of reshuffling every time React re-renders the tree.
 */
function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

const layer = 'pointer-events-none absolute inset-0 overflow-hidden';

/* ── Static texture layers ─────────────────────────────────────────────── */

const Grain = memo(function Grain() {
  return <div className={`${layer} vm-grain`} />;
});

const Scanlines = memo(function Scanlines() {
  return <div className={`${layer} vm-scanlines`} />;
});

const Vignette = memo(function Vignette() {
  return (
    <div
      className={layer}
      style={{
        background:
          'radial-gradient(125% 100% at 50% 42%, transparent 45%, color-mix(in oklab, var(--c-background) 88%, black) 100%)',
      }}
    />
  );
});

/* ── Animated layers ───────────────────────────────────────────────────── */

/** Dust caught in lamp light — slow, sparse, warm. */
const Dust = memo(function Dust() {
  return (
    <div className={layer}>
      {Array.from({ length: 26 }, (_, index) => {
        const size = 1.5 + noise(index) * 3;
        return (
          <span
            key={index}
            className="absolute rounded-full bg-primary"
            style={
              {
                left: `${noise(index + 1) * 100}%`,
                bottom: `-${noise(index + 2) * 30}%`,
                width: size,
                height: size,
                filter: 'blur(0.4px)',
                animation: `vm-drift ${22 + noise(index + 3) * 26}s linear ${noise(index + 4) * -30}s infinite`,
                '--vm-dx': `${noise(index + 5) * 90 - 45}px`,
                '--vm-peak': 0.14 + noise(index + 6) * 0.3,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
});

/** Diagonal daylight shafts from an off-screen window. */
const Daylight = memo(function Daylight() {
  return (
    <div className={layer}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="absolute -top-1/4 h-[150%] origin-top"
          style={{
            left: `${6 + index * 13}%`,
            width: `${70 + index * 40}px`,
            transform: 'rotate(14deg)',
            background:
              'linear-gradient(to bottom, color-mix(in oklab, var(--c-primary) 16%, transparent), transparent 78%)',
            filter: 'blur(22px)',
            opacity: 0.45 - index * 0.1,
          }}
        />
      ))}
    </div>
  );
});

/** Slow drifting haze, used to soften deep-night palettes. */
const Haze = memo(function Haze() {
  return (
    <div className={layer}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="absolute rounded-full"
          style={{
            left: `${10 + index * 30}%`,
            top: `${20 + index * 18}%`,
            width: `${280 + index * 120}px`,
            height: `${280 + index * 120}px`,
            background: `radial-gradient(circle, color-mix(in oklab, var(--c-${
              index % 2 ? 'secondary' : 'primary'
            }) 18%, transparent), transparent 68%)`,
            filter: 'blur(40px)',
            animation: `vm-pulse ${16 + index * 7}s ease-in-out ${index * 3}s infinite`,
          }}
        />
      ))}
    </div>
  );
});

/** Effects that cost nothing to leave running when motion is switched off. */
const STATIC_EFFECTS: Partial<Record<keyof VibeEffects, ComponentType>> = {
  grain: Grain,
  scanlines: Scanlines,
  vignette: Vignette,
};

const MOTION_EFFECTS: Partial<Record<keyof VibeEffects, ComponentType>> = {
  dust: Dust,
  daylight: Daylight,
  haze: Haze,
};

/**
 * Renders whichever ambient layers the active theme asks for. Unknown keys in
 * `theme.effects` are ignored, so themes and effects can be added
 * independently of each other.
 */
export function AmbientEffects() {
  const { theme, preferences, motionEnabled } = useVibe();

  if (!preferences.ambient) return null;

  const effects = theme.effects ?? {};
  const active = Object.entries(effects).filter(([, enabled]) => enabled);

  return (
    // Above the scene (`z-0`), below the interface (`z-10`).
    <div className="pointer-events-none fixed inset-0 z-2 overflow-hidden" aria-hidden="true">
      {active.map(([name]) => {
        const key = name as keyof VibeEffects;
        const Static = STATIC_EFFECTS[key];
        if (Static) return <Static key={name} />;

        // Daylight is a gradient wash rather than motion, so it survives the
        // reduced-motion switch; everything else in this group animates.
        const Animated = MOTION_EFFECTS[key];
        if (!Animated) return null;
        if (!motionEnabled && key !== 'daylight' && key !== 'haze') return null;
        return <Animated key={name} />;
      })}
    </div>
  );
}
