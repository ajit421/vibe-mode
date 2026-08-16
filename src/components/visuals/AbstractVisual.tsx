import type { CSSProperties } from 'react';
import { useVibe } from '@/state/vibe-context';

/**
 * The fallback scene. A brand-new theme that has not been given bespoke
 * artwork still gets something that looks deliberate, built entirely from its
 * own palette — so `visual: 'anything'` never renders an empty box.
 */
export function AbstractVisual() {
  const { theme, motionEnabled } = useVibe();
  const { primary, secondary, accent } = theme.colors;

  return (
    <svg
      viewBox="0 0 800 560"
      // Fills the screen and crops, rather than letterboxing: this scene is
      // the page background now, so it must cover whatever shape the window is.
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      role="img"
      aria-label={`${theme.name}: an abstract visual built from the mode's colours.`}
    >
      <defs>
        <radialGradient id="ab-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={primary} stopOpacity="0.45" />
          <stop offset="1" stopColor={primary} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="400" cy="280" r="240" fill="url(#ab-glow)" />

      {/* Orbits */}
      {[150, 195, 240].map((radius, index) => (
        <ellipse
          key={radius}
          cx="400"
          cy="280"
          rx={radius}
          ry={radius * 0.62}
          fill="none"
          stroke={index === 1 ? secondary : primary}
          strokeOpacity={0.22 + index * 0.06}
          strokeWidth="1.5"
          style={
            motionEnabled
              ? ({
                  transformOrigin: '400px 280px',
                  animation: `vm-spin ${26 + index * 9}s linear infinite ${index % 2 ? 'reverse' : 'normal'}`,
                } as CSSProperties)
              : undefined
          }
        />
      ))}

      {/* Equaliser */}
      <g>
        {Array.from({ length: 19 }, (_, index) => {
          const height = 22 + Math.abs(Math.sin(index * 1.1)) * 118;
          return (
            <rect
              key={index}
              x={220 + index * 20}
              y={340 - height / 2}
              width="8"
              height={height}
              rx="4"
              fill={index % 4 === 0 ? accent : primary}
              opacity={0.35 + (index % 5) * 0.1}
              style={
                motionEnabled
                  ? ({
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                      animation: `vm-pulse ${1.4 + (index % 6) * 0.24}s ease-in-out ${index * 0.07}s infinite`,
                    } as CSSProperties)
                  : undefined
              }
            />
          );
        })}
      </g>

      <text
        x="400"
        y="470"
        textAnchor="middle"
        fontFamily="var(--f-mono)"
        fontSize="13"
        letterSpacing="6"
        fill={secondary}
        opacity="0.7"
      >
        {theme.shortName.toUpperCase()}
      </text>
      <text x="400" y="150" textAnchor="middle" fontSize="44" opacity="0.9">
        {theme.emoji}
      </text>
    </svg>
  );
}
