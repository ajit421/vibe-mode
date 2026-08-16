import type { VibeTheme } from '@/types/theme';

interface MiniPreviewProps {
  theme: VibeTheme;
  /** Cheap, non-animated rendering for reduced-motion and long lists. */
  still?: boolean;
}

/**
 * The little animated thumbnail on each mode card. Deliberately abstract —
 * three or four shapes that hint at the full scene without paying for it.
 */
export function MiniPreview({ theme, still }: MiniPreviewProps) {
  const { primary, secondary, accent } = theme.colors;
  const drift = (seconds: number, delay = 0) =>
    still
      ? undefined
      : { animation: `vm-slide-x ${seconds}s linear ${delay}s infinite`, ['--vm-x' as string]: '-40px' };

  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden="true" preserveAspectRatio="none">
      <rect width="120" height="72" fill={theme.colors.backgroundAlt} />

      {theme.hero.visual === 'judaad-desk' && (
        <>
          <path d="M0 52h120v4H0z" fill={primary} opacity="0.35" />
          <rect x="40" y="24" width="34" height="24" rx="2" fill={theme.colors.surface} stroke={secondary} strokeOpacity="0.5" />
          <rect x="44" y="28" width="26" height="16" fill={accent} opacity="0.18" />
          <circle cx="92" cy="18" r="9" fill={primary} opacity="0.5" />
          <path d="M92 27v22" stroke={primary} strokeOpacity="0.4" strokeWidth="2" />
          <circle cx="24" cy="46" r="3" fill={accent} className={still ? undefined : 'vm-blink'} />
        </>
      )}

      {theme.hero.visual === 'metro-coach' && (
        <>
          <rect x="10" y="14" width="100" height="34" rx="4" fill="#02060c" stroke={primary} strokeOpacity="0.45" />
          <g style={drift(1.1)}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <rect key={index} x={12 + index * 20} y="22" width="3" height="18" rx="1.5" fill={accent} opacity="0.85" />
            ))}
          </g>
          <rect x="10" y="56" width="100" height="8" rx="4" fill={primary} opacity="0.3" />
          <rect x="16" y="6" width="88" height="5" rx="2.5" fill={accent} opacity="0.55" />
        </>
      )}

      {theme.hero.visual === 'train-window' && (
        <>
          <rect x="8" y="12" width="104" height="38" rx="3" fill={primary} opacity="0.35" />
          <g style={drift(2.6)}>
            {[0, 1, 2, 3].map((index) => (
              <path key={index} d={`M${8 + index * 40} 42 q 10 -14 20 -6 q 8 -10 20 4z`} fill={secondary} opacity="0.75" />
            ))}
          </g>
          <path d="M8 24h104M8 34h104" stroke={theme.colors.background} strokeWidth="2.5" opacity="0.75" />
          <rect x="8" y="52" width="104" height="6" rx="2" fill={theme.colors.surface} />
        </>
      )}

      {theme.hero.visual === 'cab-window' && (
        <>
          <path d="M0 44 L48 20 L72 20 L120 44z" fill={theme.colors.surface} />
          <g style={drift(0.9)}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <rect key={index} x={index * 20} y="34" width="10" height="2" rx="1" fill={accent} opacity="0.7" />
            ))}
          </g>
          <circle cx="24" cy="16" r="4" fill={accent} opacity="0.8" />
          <circle cx="98" cy="14" r="4" fill={primary} opacity="0.8" />
          <path d="M0 52h120v20H0z" fill={theme.colors.background} />
          <path d="M78 66 q -18 -6 -26 -14" stroke={primary} strokeWidth="2" fill="none" strokeDasharray="4 3" />
        </>
      )}

      {theme.hero.visual === 'office-desk' && (
        <>
          <rect x="30" y="14" width="60" height="36" rx="3" fill={theme.colors.surface} stroke={secondary} strokeOpacity="0.4" />
          {[0, 1, 2, 3].map((index) => (
            <rect key={index} x="36" y={22 + index * 7} width={34 - index * 6} height="3" rx="1.5" fill={index === 1 ? accent : primary} opacity="0.6" />
          ))}
          <path d="M54 50h12l3 8H51z" fill={theme.colors.surface} />
          <path d="M0 58h120v3H0z" fill={primary} opacity="0.3" />
          <rect x="98" y="42" width="10" height="14" rx="2" fill={accent} opacity="0.4" />
        </>
      )}

      {theme.hero.visual === 'radio-set' && (
        <>
          <rect x="16" y="16" width="88" height="44" rx="6" fill={theme.colors.surface} stroke={primary} strokeOpacity="0.5" />
          <rect x="22" y="22" width="34" height="32" rx="3" fill={secondary} opacity="0.28" />
          <g stroke={secondary} strokeWidth="1" opacity="0.4">
            {[0, 1, 2, 3].map((index) => (
              <path key={index} d={`M22 ${28 + index * 8} h34`} />
            ))}
          </g>
          <rect x="62" y="22" width="36" height="16" rx="2" fill={primary} opacity="0.75" />
          <path d="M74 22 v16" stroke="#c0392b" strokeWidth="1.5" className={still ? undefined : 'vm-blink'} />
          <circle cx="68" cy="50" r="5" fill={theme.colors.background} stroke={primary} strokeOpacity="0.6" />
          <circle cx="86" cy="50" r="5" fill={theme.colors.background} stroke={primary} strokeOpacity="0.6" />
          <path d="M96 16 L110 4" stroke={accent} strokeWidth="1.5" />
        </>
      )}

      {theme.hero.visual === 'gadi-stereo' && (
        <>
          <path d="M0 40 q 60 -18 120 0 l0 32 L0 72z" fill={theme.colors.surface} />
          <rect x="34" y="20" width="52" height="28" rx="4" fill={theme.colors.background} stroke={primary} strokeOpacity="0.6" />
          <g>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
              <rect
                key={index}
                x={38 + index * 6}
                y="30"
                width="3"
                height="14"
                rx="1.5"
                fill={index % 3 === 0 ? accent : primary}
                style={
                  still
                    ? { transformBox: 'fill-box', transformOrigin: 'center bottom', transform: 'scaleY(0.6)' }
                    : {
                        transformBox: 'fill-box',
                        transformOrigin: 'center bottom',
                        animation: `vm-eq ${0.7 + (index % 4) * 0.18}s ease-in-out ${index * 0.06}s infinite`,
                      }
                }
              />
            ))}
          </g>
          <circle cx="100" cy="56" r="9" fill="none" stroke={secondary} strokeWidth="2" />
          <circle cx="20" cy="56" r="11" fill="none" stroke={primary} strokeWidth="2" />
          <g stroke={accent} strokeWidth="1.5" fill="none" opacity="0.7">
            <path d="M0 14 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6" />
          </g>
        </>
      )}

      {theme.hero.visual === 'college-desk' && (
        <>
          <rect x="14" y="8" width="92" height="34" rx="3" fill={secondary} opacity="0.22" />
          <rect x="14" y="8" width="92" height="34" rx="3" fill="none" stroke={secondary} strokeOpacity="0.4" />
          <g stroke={theme.colors.text} strokeWidth="1.4" opacity="0.55">
            <path d="M22 18 h44M22 26 h30" />
          </g>
          <text x="70" y="30" fontSize="9" fontFamily="var(--f-mono)" fill={primary} opacity="0.9">
            61%
          </text>
          <path d="M0 48 h120v24H0z" fill={theme.colors.surface} />
          <rect x="24" y="42" width="42" height="22" rx="2" fill="#f4f1e2" opacity="0.9" />
          <g stroke="#b9cbe0" strokeWidth="0.8">
            <path d="M28 48 h34M28 54 h34M28 60 h24" />
          </g>
          <rect x="78" y="42" width="14" height="22" rx="3" fill={theme.colors.background} stroke={accent} strokeOpacity="0.6" />
          <path d="M85 64 c -10 4 -18 2 -24 6" stroke={theme.colors.text} strokeWidth="1" fill="none" opacity="0.6" />
        </>
      )}

      {/* Anything without bespoke art still gets a themed thumbnail. */}
      {![
        'judaad-desk',
        'metro-coach',
        'train-window',
        'cab-window',
        'office-desk',
        'radio-set',
        'gadi-stereo',
        'college-desk',
      ].includes(theme.hero.visual) && (
        <>
          <circle cx="60" cy="34" r="20" fill="none" stroke={primary} strokeOpacity="0.5" strokeWidth="2" />
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <rect
              key={index}
              x={32 + index * 9}
              y={34 - (6 + (index % 3) * 8)}
              width="4"
              height={12 + (index % 3) * 16}
              rx="2"
              fill={index % 2 ? accent : secondary}
              opacity="0.7"
            />
          ))}
        </>
      )}

      <rect width="120" height="72" fill="url(#mini-fade)" />
      <defs>
        <linearGradient id="mini-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.5" stopColor={theme.colors.background} stopOpacity="0" />
          <stop offset="1" stopColor={theme.colors.background} stopOpacity="0.65" />
        </linearGradient>
      </defs>
    </svg>
  );
}
