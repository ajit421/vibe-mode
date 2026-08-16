import { type CSSProperties } from 'react';
import { useToast } from '@/state/toast-context';
import { useVibe } from '@/state/vibe-context';
import { EMPTY_ITEMS, useRotator } from '@/hooks/useRotator';
import { Hotspot } from './Hotspot';

/** Syntax-coloured filler — shaped like real code without pretending to be any. */
const CODE_LINES: { indent: number; tokens: [string, string][] }[] = [
  { indent: 0, tokens: [['import', '#c792ea'], [' { useVibe } ', '#e7eef6'], ['from', '#c792ea'], [" '@/state'", '#c3e88d']] },
  { indent: 0, tokens: [['', '#e7eef6']] },
  { indent: 0, tokens: [['export function', '#c792ea'], [' Monday', '#82aaff'], ['() {', '#e7eef6']] },
  { indent: 1, tokens: [['const', '#c792ea'], [' focus = ', '#e7eef6'], ['useFocus', '#82aaff'], ['()', '#e7eef6']] },
  { indent: 1, tokens: [['if', '#c792ea'], [' (!focus) ', '#e7eef6'], ['return', '#c792ea'], [' coffee', '#e7eef6']] },
  { indent: 1, tokens: [['// TODO: refactor this before the demo', '#5f7285']] },
  { indent: 1, tokens: [['return', '#c792ea'], [' ship(', '#e7eef6'], ["'friday'", '#c3e88d'], [')', '#e7eef6']] },
  { indent: 0, tokens: [['}', '#e7eef6']] },
];

/** A calm desk with a second monitor, a plant nobody waters, and cold coffee. */
export function OfficeDeskVisual() {
  const { push } = useToast();
  const { theme, motionEnabled } = useVibe();
  const ticker = useRotator(theme.ticker ?? EMPTY_ITEMS, { intervalMs: 4200 });

  return (
    <svg
      viewBox="0 0 800 560"
      // `meet`, not `slice`: the whole scene must be visible. Cropping it to
      // fill the window reads as a zoomed-in detail, not as a place. What is
      // left over around it is transparent, so the theme gradient shows.
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      // `group`, not `img` — `img` makes descendants presentational, hiding the
      // Hotspots from screen readers while they stay keyboard-focusable.
      role="group"
      aria-label="An office desk: a monitor with a code editor open, a laptop, keyboard, coffee mug, a small plant and daylight from a window."
    >
      <defs>
        <linearGradient id="of-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2836" />
          <stop offset="1" stopColor="#101923" />
        </linearGradient>
        <linearGradient id="of-desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a7259" />
          <stop offset="0.08" stopColor="#6d5842" />
          <stop offset="1" stopColor="#3d3126" />
        </linearGradient>
        <linearGradient id="of-daylight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bfe3ff" stopOpacity="0.24" />
          <stop offset="1" stopColor="#bfe3ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="of-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fc9e8" />
          <stop offset="1" stopColor="#d6e6f2" />
        </linearGradient>
        <clipPath id="of-editor">
          <rect x="270" y="176" width="316" height="176" />
        </clipPath>
        <radialGradient id="of-vig" cx="0.5" cy="0.42" r="0.8">
          <stop offset="0.52" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="800" height="560" fill="url(#of-wall)" />
      <rect x="0" y="404" width="800" height="156" fill="#0b1219" />

      {/* ── Window + daylight ───────────────────────────────────────────── */}
      <g>
        <rect x="44" y="70" width="172" height="196" rx="4" fill="#0d151f" stroke="#243342" strokeWidth="6" />
        <rect x="54" y="80" width="152" height="176" fill="url(#of-sky)" />
        {/* Distant buildings */}
        <g fill="#8fb0c9" opacity="0.85">
          <rect x="60" y="176" width="30" height="80" />
          <rect x="96" y="150" width="24" height="106" />
          <rect x="126" y="188" width="34" height="68" />
          <rect x="166" y="162" width="34" height="94" />
        </g>
        <g fill="#6f94b0" opacity="0.6">
          {Array.from({ length: 18 }, (_, index) => (
            <rect key={index} x={64 + ((index * 23) % 130)} y={166 + ((index * 19) % 76)} width="4" height="5" />
          ))}
        </g>
        {/* Mullions */}
        <path d="M130 80 v176M54 168 h152" stroke="#243342" strokeWidth="5" />
      </g>
      {/* Light shaft across the desk */}
      <path d="M216 96 L470 404 L232 404 L108 266 Z" fill="url(#of-daylight)" />

      {/* ── Wall calendar ───────────────────────────────────────────────── */}
      <g>
        <rect x="640" y="86" width="112" height="96" rx="5" fill="#141e29" stroke="#22303f" />
        <rect x="640" y="86" width="112" height="22" rx="5" fill="#7dd3fc" opacity="0.22" />
        <text x="696" y="101" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="#7dd3fc" letterSpacing="1.5">
          THIS WEEK
        </text>
        <g fill="#33455a">
          {Array.from({ length: 20 }, (_, index) => (
            <rect
              key={index}
              x={650 + (index % 5) * 21}
              y={116 + Math.floor(index / 5) * 15}
              width="16"
              height="11"
              rx="2"
              fill={[2, 6, 7, 11, 13, 16, 17, 18].includes(index) ? '#4ade80' : '#22303f'}
              opacity={[2, 6, 7, 11, 13, 16, 17, 18].includes(index) ? 0.55 : 1}
            />
          ))}
        </g>
      </g>

      {/* ── Desk ─────────────────────────────────────────────────────────── */}
      <rect x="30" y="398" width="740" height="14" rx="3" fill="url(#of-desk)" />
      <rect x="30" y="412" width="740" height="20" fill="#2b2319" />
      <rect x="66" y="432" width="12" height="106" fill="#241d15" />
      <rect x="722" y="432" width="12" height="106" fill="#241d15" />

      {/* ── Monitor ──────────────────────────────────────────────────────── */}
      <Hotspot label="Read what is on the screen" onActivate={() => push(ticker.item ?? '> looks fine to me', 'SCREEN')}>
        {/* Stand */}
        <path d="M396 358 l44 0 l8 40 l-60 0z" fill="#1b2530" />
        <rect x="368" y="392" width="100" height="8" rx="4" fill="#22303f" />
        {/* Bezel */}
        <rect x="258" y="164" width="340" height="200" rx="10" fill="#161f29" stroke="#26333f" strokeWidth="2" />
        <rect x="270" y="176" width="316" height="176" rx="3" fill="#0d141c" />

        <g clipPath="url(#of-editor)">
          {/* Editor chrome */}
          <rect x="270" y="176" width="316" height="18" fill="#131c25" />
          {['#f87171', '#fbbf24', '#4ade80'].map((color, index) => (
            <circle key={color} cx={280 + index * 11} cy="185" r="3.4" fill={color} opacity="0.85" />
          ))}
          <rect x="318" y="179" width="76" height="12" rx="3" fill="#1b2733" />
          <text x="326" y="188" fontFamily="var(--f-mono)" fontSize="7" fill="#7f93a8">
            monday.ts
          </text>

          {/* Sidebar */}
          <rect x="270" y="194" width="26" height="158" fill="#101822" />
          {[0, 1, 2, 3].map((index) => (
            <rect key={index} x="277" y={204 + index * 16} width="12" height="3" rx="1.5" fill="#2c3d4f" />
          ))}

          {/* Gutter + code */}
          {CODE_LINES.map((line, index) => (
            <g key={index}>
              <text x="312" y={210 + index * 15} textAnchor="end" fontFamily="var(--f-mono)" fontSize="7.5" fill="#3d4f61">
                {index + 1}
              </text>
              <text x={320 + line.indent * 12} y={210 + index * 15} fontFamily="var(--f-mono)" fontSize="8">
                {line.tokens.map(([text, fill], tokenIndex) => (
                  <tspan key={tokenIndex} fill={fill}>
                    {text}
                  </tspan>
                ))}
              </text>
            </g>
          ))}
          <rect
            x="320"
            y={210 + CODE_LINES.length * 15 - 8}
            width="6"
            height="10"
            fill="#7dd3fc"
            className={motionEnabled ? 'vm-caret' : undefined}
          />

          {/* Terminal drawer */}
          <rect x="296" y="322" width="290" height="30" fill="#0a1119" />
          <path d="M296 322 h290" stroke="#1e2b38" />
          <text x="306" y="341" fontFamily="var(--f-mono)" fontSize="7.5" fill="#4ade80">
            {(ticker.item ?? '> all good').slice(0, 52)}
          </text>
        </g>

        {/* Screen glass */}
        <path d="M270 176 L340 176 L280 352 L270 352 Z" fill="#ffffff" opacity="0.03" />
        <circle cx="428" cy="358" r="2" fill="#4ade80" opacity="0.8" />
      </Hotspot>

      {/* ── Notification chip ───────────────────────────────────────────── */}
      {/* No animation-delay here: a delayed `both`-filled animation holds the
          element at opacity 0, so it would stay invisible for as long as
          animations are paused (a backgrounded tab). */}
      <g
        style={
          motionEnabled
            ? ({ animation: 'vm-rise 0.5s ease-out both' } as CSSProperties)
            : undefined
        }
      >
        <rect x="452" y="196" width="122" height="34" rx="7" fill="#16222e" stroke="#2b3d4e" opacity="0.97" />
        <circle cx="468" cy="213" r="5" fill="#a5b4fc" />
        <text x="480" y="210" fontFamily="var(--f-mono)" fontSize="7" fill="#8b9cb0" letterSpacing="0.8">
          CALENDAR
        </text>
        <text x="480" y="222" fontFamily="var(--f-mono)" fontSize="8" fill="#e7eef6">
          Standup in 8 min
        </text>
      </g>

      {/* ── Sticky notes on the bezel ───────────────────────────────────── */}
      <g>
        <rect x="600" y="188" width="52" height="50" rx="1" fill="#f6e05e" opacity="0.9" transform="rotate(4 626 213)" />
        <text x="608" y="210" fontFamily="var(--f-mono)" fontSize="7.5" fill="#3f3a19" transform="rotate(4 626 213)">
          ASK RE:
        </text>
        <text x="608" y="222" fontFamily="var(--f-mono)" fontSize="7.5" fill="#3f3a19" transform="rotate(4 626 213)">
          THE THING
        </text>
        <rect x="606" y="248" width="52" height="50" rx="1" fill="#9ae6b4" opacity="0.85" transform="rotate(-5 632 273)" />
        <text x="614" y="272" fontFamily="var(--f-mono)" fontSize="7.5" fill="#1e3a2a" transform="rotate(-5 632 273)">
          DEPLOY
        </text>
        <text x="614" y="284" fontFamily="var(--f-mono)" fontSize="7.5" fill="#1e3a2a" transform="rotate(-5 632 273)">
          NOT FRIDAY
        </text>
      </g>

      {/* ── Laptop, half closed ─────────────────────────────────────────── */}
      <g>
        <path d="M120 336 l150 -8 l0 62 l-150 8z" fill="#1c262f" />
        <path d="M128 342 l134 -7 l0 50 l-134 7z" fill="#0e161e" />
        <path d="M128 342 l40 -2 l-30 55 l-10 0z" fill="#ffffff" opacity="0.04" />
        <path d="M112 390 l166 0 l10 14 l-186 0z" fill="#232f3a" />
        <path d="M112 390 l166 0 l2 3 l-170 0z" fill="#32414f" />
      </g>

      {/* ── Keyboard + mouse ────────────────────────────────────────────── */}
      <g>
        <rect x="308" y="404" width="196" height="10" rx="3" fill="#1d2731" />
        <rect x="308" y="404" width="196" height="3" rx="1.5" fill="#2b3945" />
        <g fill="#141d26">
          {Array.from({ length: 14 }, (_, index) => (
            <rect key={index} x={314 + index * 13.4} y="406" width="10" height="5" rx="1" />
          ))}
        </g>
        <ellipse cx="546" cy="410" rx="15" ry="9" fill="#1d2731" />
        <path d="M546 402 v7" stroke="#2b3945" strokeWidth="1.5" />
      </g>

      {/* ── Coffee ──────────────────────────────────────────────────────── */}
      <Hotspot label="Reach for the coffee" onActivate={() => push('Cold. Third cup. Still drinking it.', 'COFFEE')}>
        {motionEnabled && (
          <g opacity="0.35">
            {[0, 1].map((index) => (
              <path
                key={index}
                d="M0 0 c -3 -8 3 -13 0 -20"
                transform={`translate(${638 + index * 9} 372)`}
                stroke="#e7eef6"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                style={
                  {
                    animation: `vm-steam ${3.2 + index * 0.6}s ease-out ${index * 0.9}s infinite`,
                    '--vm-dx': `${index * 5 - 3}px`,
                  } as CSSProperties
                }
              />
            ))}
          </g>
        )}
        <path d="M620 374 l38 0 l-4 28 l-30 0z" fill="#e8eef4" />
        <path d="M658 380 c 12 0 12 15 0 15" stroke="#e8eef4" strokeWidth="4" fill="none" />
        <ellipse cx="639" cy="375" rx="19" ry="3.6" fill="#4a3428" />
        <rect x="624" y="386" width="30" height="8" fill="#7dd3fc" opacity="0.25" />
      </Hotspot>

      {/* ── Plant ───────────────────────────────────────────────────────── */}
      <Hotspot label="Check on the plant" onActivate={() => push('Nobody has watered this since March.', 'PLANT')}>
        <path d="M700 366 l40 0 l-5 34 l-30 0z" fill="#b6704a" />
        <path d="M698 362 l44 0 l0 8 l-44 0z" fill="#c98157" />
        <g stroke="#4ade80" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85">
          <path d="M720 364 c -2 -20 -16 -26 -22 -30" />
          <path d="M720 364 c 2 -22 14 -28 22 -30" />
          <path d="M720 364 c 0 -26 -4 -34 -4 -42" />
        </g>
        <g fill="#4ade80" opacity="0.8">
          <ellipse cx="696" cy="332" rx="9" ry="5" transform="rotate(-28 696 332)" />
          <ellipse cx="744" cy="332" rx="9" ry="5" transform="rotate(28 744 332)" />
          <ellipse cx="716" cy="318" rx="6" ry="9" />
        </g>
      </Hotspot>

      {/* ── Desk clutter ────────────────────────────────────────────────── */}
      <g>
        <rect x="176" y="396" width="70" height="6" rx="2" fill="#22303f" />
        <rect x="182" y="390" width="58" height="6" rx="2" fill="#2b3d4e" />
        <rect x="188" y="384" width="46" height="6" rx="2" fill="#33465a" />
      </g>

      <rect x="0" y="0" width="800" height="560" fill="url(#of-vig)" pointerEvents="none" />
    </svg>
  );
}
