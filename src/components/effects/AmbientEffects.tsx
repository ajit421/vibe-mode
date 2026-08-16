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

const Rain = memo(function Rain() {
  return (
    <div className={layer}>
      {Array.from({ length: 44 }, (_, index) => (
        <span
          key={index}
          className="absolute top-[-10%] w-px rounded-full"
          style={
            {
              left: `${noise(index) * 100}%`,
              height: `${28 + noise(index + 1) * 54}px`,
              background:
                'linear-gradient(to bottom, transparent, color-mix(in oklab, var(--c-secondary) 70%, white))',
              animation: `vm-rain ${0.85 + noise(index + 2) * 0.9}s linear ${noise(index + 3) * -2}s infinite`,
              '--vm-peak': 0.18 + noise(index + 4) * 0.34,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
});

/** Tunnel service lights sweeping past, well behind the main scene. */
const TunnelLights = memo(function TunnelLights() {
  return (
    <div className={layer}>
      {Array.from({ length: 16 }, (_, index) => (
        <span
          key={index}
          className="absolute w-[3px] rounded-full bg-accent"
          style={
            {
              left: `${noise(index) * 100}%`,
              top: `-${20 + noise(index + 1) * 20}%`,
              height: `${60 + noise(index + 2) * 120}px`,
              opacity: 0.16 + noise(index + 3) * 0.24,
              filter: 'blur(1.5px)',
              animation: `vm-streak ${1.1 + noise(index + 4) * 1.4}s linear ${noise(index + 5) * -2.5}s infinite`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
});

/** A soft parallax band along the bottom — scenery glimpsed past the coach. */
const Landscape = memo(function Landscape() {
  return (
    <div className={`${layer} flex items-end`} aria-hidden="true">
      <div
        className="vm-marquee-track flex h-40 w-[200%] items-end opacity-25"
        style={{ '--vm-duration': '48s' } as CSSProperties}
      >
        {[0, 1].map((copy) => (
          <svg key={copy} viewBox="0 0 1200 160" className="h-full w-1/2" preserveAspectRatio="none">
            <path
              d="M0 160 L0 112 q 60 -42 120 -14 q 70 -46 140 -6 q 54 -34 110 -2 q 76 -50 150 -8 q 62 -38 128 4 q 70 -34 140 2 q 60 -24 120 6 q 60 -30 120 2 q 90 -34 172 6 L1200 160z"
              fill="var(--c-secondary)"
              opacity="0.5"
            />
            <g fill="var(--c-primary)" opacity="0.35">
              {Array.from({ length: 14 }, (_, index) => (
                <rect key={index} x={40 + index * 86} y="96" width="4" height="64" />
              ))}
            </g>
          </svg>
        ))}
      </div>
    </div>
  );
});

/** Streetlight smears and a wet-tarmac glow across the bottom. */
const Traffic = memo(function Traffic() {
  return (
    <div className={layer}>
      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background:
            'linear-gradient(to top, color-mix(in oklab, var(--c-primary) 14%, transparent), transparent)',
        }}
      />
      {Array.from({ length: 12 }, (_, index) => (
        <span
          key={index}
          className="absolute h-[2px] rounded-full"
          style={
            {
              left: `${noise(index) * 100}%`,
              top: `${45 + noise(index + 1) * 45}%`,
              width: `${40 + noise(index + 2) * 130}px`,
              background: index % 2 ? 'var(--c-primary)' : 'var(--c-secondary)',
              opacity: 0.14 + noise(index + 3) * 0.2,
              filter: 'blur(2px)',
              animation: `vm-marquee ${5 + noise(index + 4) * 7}s linear ${noise(index + 5) * -8}s infinite`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
});

/** The slow sweep of a ceiling fan across the room. */
const FanShadow = memo(function FanShadow() {
  return (
    <div className={`${layer} flex items-start justify-center`}>
      <div
        className="mt-[-30vh] h-[80vh] w-[80vh] opacity-[0.055]"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, black 22deg, transparent 46deg, transparent 120deg, black 142deg, transparent 166deg, transparent 240deg, black 262deg, transparent 286deg)',
          animation: 'vm-spin 2.6s linear infinite',
        }}
      />
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
  rain: Rain,
  tunnelLights: TunnelLights,
  landscape: Landscape,
  traffic: Traffic,
  fanShadow: FanShadow,
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
    <div className="pointer-events-none fixed inset-0 -z-5 overflow-hidden" aria-hidden="true">
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
