import { useState, type CSSProperties } from 'react';
import { useToast } from '@/state/toast-context';
import { useVibe } from '@/state/vibe-context';
import { Hotspot } from './Hotspot';

const SPEEDS = [
  { id: 'slow', label: 'Crawling past a village', factor: 2.1 },
  { id: 'cruise', label: 'Full speed. Hair everywhere.', factor: 1 },
  { id: 'fast', label: 'Overtaking everything.', factor: 0.55 },
] as const;

/** A window seat on an Indian Railways coach, late afternoon, fields going by. */
export function TrainWindowVisual() {
  const { push } = useToast();
  const { motionEnabled } = useVibe();
  const [speedIndex, setSpeedIndex] = useState(1);
  const speed = SPEEDS[speedIndex];

  const slide = (units: number, baseSeconds: number): CSSProperties =>
    motionEnabled
      ? ({
          animation: `vm-slide-x ${baseSeconds * speed.factor}s linear infinite`,
          '--vm-x': `${units}px`,
        } as CSSProperties)
      : {};

  return (
    <svg
      viewBox="0 0 800 560"
      // Fills the screen and crops, rather than letterboxing: this scene is
      // the page background now, so it must cover whatever shape the window is.
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${motionEnabled ? 'vm-shudder' : ''}`}
      // `group`, not `img` — `img` makes descendants presentational, hiding the
      // Hotspots from screen readers while they stay keyboard-focusable.
      role="group"
      aria-label="A window seat on an Indian train: barred window, fields and hills sliding past at golden hour, a paper ticket and a glass of chai on the ledge."
    >
      <defs>
        <linearGradient id="tr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f4a6b" />
          <stop offset="0.42" stopColor="#c9773f" />
          <stop offset="0.72" stopColor="#e8b04b" />
          <stop offset="1" stopColor="#f0cf8a" />
        </linearGradient>
        <linearGradient id="tr-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d3b34" />
          <stop offset="0.6" stopColor="#152b26" />
          <stop offset="1" stopColor="#0f1f1b" />
        </linearGradient>
        <linearGradient id="tr-ledge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f5f55" />
          <stop offset="1" stopColor="#22403a" />
        </linearGradient>
        <clipPath id="tr-window">
          <rect x="130" y="128" width="540" height="252" rx="10" />
        </clipPath>
        <radialGradient id="tr-vig" cx="0.5" cy="0.45" r="0.78">
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.58" />
        </radialGradient>
      </defs>

      {/* ── Coach interior ───────────────────────────────────────────────── */}
      <rect x="0" y="0" width="800" height="560" fill="url(#tr-wall)" />
      {/* Rivet lines */}
      <g fill="#2a4a42" opacity="0.6">
        {Array.from({ length: 16 }, (_, index) => (
          <circle key={`t${index}`} cx={30 + index * 50} cy="30" r="2.5" />
        ))}
        {Array.from({ length: 16 }, (_, index) => (
          <circle key={`b${index}`} cx={30 + index * 50} cy="530" r="2.5" />
        ))}
      </g>

      {/* Ceiling fan */}
      <g transform="translate(400 26)">
        <circle r="7" fill="#2c4c44" />
        <g
          style={
            motionEnabled
              ? ({ animation: 'vm-spin 0.9s linear infinite', transformOrigin: '0px 0px' } as CSSProperties)
              : undefined
          }
          opacity="0.5"
        >
          {[0, 120, 240].map((angle) => (
            <ellipse key={angle} rx="34" ry="5" transform={`rotate(${angle})`} fill="#38635a" />
          ))}
        </g>
      </g>

      {/* ── Window opening ──────────────────────────────────────────────── */}
      <g clipPath="url(#tr-window)">
        <rect x="130" y="128" width="540" height="252" fill="url(#tr-sky)" />

        {/* Sun */}
        <circle cx="560" cy="252" r="30" fill="#fff0c8" opacity="0.9" />
        <circle cx="560" cy="252" r="52" fill="#f5c96a" opacity="0.22" />

        {/* Birds */}
        <g stroke="#7a5a38" strokeWidth="1.6" fill="none" opacity="0.7">
          <path d="M232 176 q 7 -6 14 0 q 7 -6 14 0" />
          <path d="M280 196 q 5 -4 10 0 q 5 -4 10 0" />
        </g>

        {/* Far hills — repeat every 270 units */}
        <g style={slide(-270, 26)} opacity="0.85">
          {[0, 1, 2].map((copy) => (
            <path
              key={copy}
              d={`M${130 + copy * 270} 300 q 40 -52 80 -18 q 30 -40 66 -10 q 42 -46 80 -2 q 26 -18 44 8 l0 40 l-270 0z`}
              fill="#6b5a52"
              opacity="0.65"
            />
          ))}
        </g>

        {/* Tree line + fields — repeat every 180 units */}
        <g style={slide(-180, 11)}>
          {[0, 1, 2, 3, 4].map((copy) => {
            const x = 130 + copy * 180;
            return (
              <g key={copy}>
                <rect x={x} y="316" width="180" height="64" fill="#7b8f4e" />
                <rect x={x} y="316" width="180" height="9" fill="#93a85e" />
                {/* Trees */}
                <g fill="#3f5a30">
                  <ellipse cx={x + 34} cy="304" rx="21" ry="24" />
                  <rect x={x + 31} y="304" width="6" height="18" fill="#4a3826" />
                  <ellipse cx={x + 122} cy="310" rx="15" ry="17" />
                  <rect x={x + 120} y="310" width="5" height="12" fill="#4a3826" />
                </g>
                {/* A little house */}
                <g>
                  <rect x={x + 66} y="300" width="30" height="22" fill="#b58b5e" />
                  <path d={`M${x + 62} 300 l19 -14 l19 14z`} fill="#8c5a3c" />
                  <rect x={x + 76} y="310" width="8" height="12" fill="#3d2a1c" />
                </g>
                {/* Furrows */}
                <g stroke="#6a7d43" strokeWidth="1.5" opacity="0.6">
                  <path d={`M${x} 340 h180`} />
                  <path d={`M${x} 356 h180`} />
                </g>
              </g>
            );
          })}
        </g>

        {/* Electricity poles — repeat every 135 units, closest so fastest */}
        <g style={slide(-135, 4.4)}>
          {[0, 1, 2, 3, 4, 5].map((copy) => {
            const x = 148 + copy * 135;
            return (
              <g key={copy} stroke="#3b3128" fill="#3b3128">
                <rect x={x} y="184" width="6" height="152" />
                <rect x={x - 16} y="192" width="38" height="5" />
                <path
                  d={`M${x + 3} 196 q 67 26 135 0`}
                  stroke="#2c251e"
                  strokeWidth="1.6"
                  fill="none"
                />
                <path
                  d={`M${x + 3} 206 q 67 30 135 0`}
                  stroke="#2c251e"
                  strokeWidth="1.6"
                  fill="none"
                />
              </g>
            );
          })}
        </g>

        {/* Track-side gravel blur */}
        <rect x="130" y="366" width="540" height="14" fill="#4a4038" opacity="0.8" />

        {/* Glass grime + warm bounce light */}
        <rect x="130" y="128" width="540" height="252" fill="#e8b04b" opacity="0.05" />
        <path d="M130 380 L280 128 L340 128 L190 380 Z" fill="#ffffff" opacity="0.04" />
      </g>

      {/* ── Window frame + bars ─────────────────────────────────────────── */}
      <Hotspot
        label={`Change the speed — currently ${speed.label}`}
        onActivate={() => {
          const next = (speedIndex + 1) % SPEEDS.length;
          setSpeedIndex(next);
          push(SPEEDS[next].label, 'SPEED');
        }}
      >
        <rect x="118" y="116" width="564" height="276" rx="16" fill="none" stroke="#2c4c44" strokeWidth="24" />
        <rect x="130" y="128" width="540" height="252" rx="10" fill="none" stroke="#16302a" strokeWidth="4" />
        {[188, 254, 320].map((y) => (
          <g key={y}>
            <rect x="130" y={y} width="540" height="9" rx="4.5" fill="#25443c" />
            <rect x="130" y={y} width="540" height="3" rx="1.5" fill="#3d6459" opacity="0.8" />
          </g>
        ))}
      </Hotspot>

      {/* ── Ledge ───────────────────────────────────────────────────────── */}
      <rect x="112" y="392" width="576" height="20" rx="5" fill="url(#tr-ledge)" />
      <rect x="112" y="392" width="576" height="5" rx="2.5" fill="#4e7167" opacity="0.7" />

      {/* ── Ticket ──────────────────────────────────────────────────────── */}
      <Hotspot
        label="Check the ticket"
        onActivate={() => push('Coach B4, berth 32, side lower. Confirmed.', 'TICKET')}
      >
        <g transform="rotate(-4 250 424)">
          <rect x="176" y="400" width="148" height="52" rx="3" fill="#f0e6cf" />
          <rect x="176" y="400" width="148" height="12" rx="3" fill="#dccfae" />
          <text x="184" y="409" fontFamily="var(--f-mono)" fontSize="7" fill="#6b5b3c">
            INDIAN RAILWAYS
          </text>
          <text x="184" y="428" fontFamily="var(--f-mono)" fontSize="11" fontWeight="600" fill="#2f2718">
            12951 · B4 · 32
          </text>
          <text x="184" y="442" fontFamily="var(--f-mono)" fontSize="7.5" fill="#6b5b3c">
            SIDE LOWER · CNF
          </text>
          {/* Perforation */}
          <g fill="#d9cba8">
            {Array.from({ length: 9 }, (_, index) => (
              <circle key={index} cx="300" cy={404 + index * 6} r="1.4" />
            ))}
          </g>
          <g fill="#2f2718" opacity="0.75">
            {Array.from({ length: 14 }, (_, index) => (
              <rect key={index} x={306 + index} y="418" width={index % 3 ? 0.8 : 1.8} height="24" />
            ))}
          </g>
        </g>
      </Hotspot>

      {/* ── Chai glass ──────────────────────────────────────────────────── */}
      <Hotspot label="Take a glass of chai" onActivate={() => push('Chai le lo, garam hai.', 'CHAI')}>
        {motionEnabled && (
          <g opacity="0.45">
            {[0, 1].map((index) => (
              <path
                key={index}
                d="M0 0 c -3 -8 3 -13 0 -21"
                transform={`translate(${470 + index * 10} 392)`}
                stroke="#f4ebda"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                style={
                  {
                    animation: `vm-steam ${3 + index * 0.6}s ease-out ${index * 0.8}s infinite`,
                    '--vm-dx': `${index * 5 - 3}px`,
                  } as CSSProperties
                }
              />
            ))}
          </g>
        )}
        <path d="M462 394 l30 0 l-4 26 l-22 0z" fill="#c9822f" opacity="0.9" />
        <path d="M460 392 l34 0 l-1 6 l-32 0z" fill="#e8e3d6" opacity="0.7" />
        <path d="M462 394 l30 0 l-1.2 8 l-27.6 0z" fill="#8a5a2b" />
      </Hotspot>

      {/* ── Berth plate ─────────────────────────────────────────────────── */}
      <g>
        <rect x="606" y="404" width="72" height="34" rx="4" fill="#12251f" stroke="#2c4c44" />
        <text x="642" y="419" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8" fill="#8fb573">
          BERTH
        </text>
        <text x="642" y="432" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="12" fontWeight="600" fill="#e8b04b">
          32 SL
        </text>
      </g>

      {/* ── Seat back in the foreground ─────────────────────────────────── */}
      <path d="M0 470 l800 0 l0 90 l-800 0z" fill="#123029" />
      <path d="M0 470 l800 0 l0 8 l-800 0z" fill="#1c463c" />
      <g stroke="#0d221d" strokeWidth="2" opacity="0.7">
        {Array.from({ length: 10 }, (_, index) => (
          <path key={index} d={`M${44 + index * 80} 478 l0 82`} />
        ))}
      </g>

      <rect x="0" y="0" width="800" height="560" fill="url(#tr-vig)" pointerEvents="none" />
    </svg>
  );
}
