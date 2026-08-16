import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useToast } from '@/state/toast-context';
import { useVibe } from '@/state/vibe-context';
import { subscribeVibeEvent } from '@/utils/events';
import { Hotspot } from './Hotspot';

const STATIONS = ['SECTOR 9', 'CIVIL LINES', 'VIBE', 'NOSTALGIA', 'LAST STOP'];
const CURRENT_STATION = 2;

const DEFAULT_BOARD = 'NEXT STATION: VIBE  •  अगला स्टेशन: वाइब  •  PLEASE MIND THE MUSIC  •  ';
const ANNOUNCE_BOARD = '▸ DOORS WILL OPEN ON THE LEFT  •  दरवाज़े बाईं ओर खुलेंगे  •  ';

/** Inside of a metro coach: window, LED board, straps, and the tunnel going past. */
export function MetroCoachVisual() {
  const { push } = useToast();
  const { motionEnabled } = useVibe();
  const [announcing, setAnnouncing] = useState(false);
  const timer = useRef<number | null>(null);

  const announce = () => {
    setAnnouncing(true);
    push('Doors closing. Please mind the music.', 'ANNOUNCEMENT');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAnnouncing(false), 5200);
  };

  // `A` from the shell triggers the same announcement. The ref keeps the
  // subscription stable while still calling the latest closure.
  const announceRef = useRef(announce);
  announceRef.current = announce;
  useEffect(() => subscribeVibeEvent('announce', () => announceRef.current()), []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const boardText = announcing ? ANNOUNCE_BOARD : DEFAULT_BOARD;
  const slide = (units: number, seconds: number, delay = 0): CSSProperties =>
    motionEnabled
      ? ({
          animation: `vm-slide-x ${seconds}s linear ${delay}s infinite`,
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
      aria-label="Inside a metro coach: a wide window with tunnel lights rushing past, an LED destination board, hanging straps and empty seats."
    >
      <defs>
        <linearGradient id="mt-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2637" />
          <stop offset="0.55" stopColor="#121c2b" />
          <stop offset="1" stopColor="#0b1421" />
        </linearGradient>
        <linearGradient id="mt-seat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e4a6b" />
          <stop offset="1" stopColor="#123047" />
        </linearGradient>
        <linearGradient id="mt-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0.06" />
        </linearGradient>
        <clipPath id="mt-window">
          <rect x="152" y="152" width="496" height="188" rx="14" />
        </clipPath>
        <clipPath id="mt-board">
          <rect x="136" y="62" width="528" height="34" />
        </clipPath>
        <radialGradient id="mt-vig" cx="0.5" cy="0.45" r="0.78">
          <stop offset="0.52" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
      </defs>

      {/* ── Coach interior ───────────────────────────────────────────────── */}
      <rect x="0" y="0" width="800" height="560" fill="url(#mt-wall)" />
      <rect x="0" y="470" width="800" height="90" fill="#0a121d" />
      <rect x="0" y="466" width="800" height="6" fill="#1c2b3d" />

      {/* Ribbed ceiling */}
      <g stroke="#1d2c3f" strokeWidth="2" opacity="0.8">
        {Array.from({ length: 9 }, (_, index) => (
          <path key={index} d={`M${40 + index * 92} 0 l0 40`} />
        ))}
      </g>
      <rect x="0" y="38" width="800" height="4" fill="#22344a" />

      {/* ── LED destination board ───────────────────────────────────────── */}
      <Hotspot label="Play the station announcement" onActivate={announce}>
        <rect x="128" y="54" width="544" height="50" rx="6" fill="#080d15" stroke="#22344a" />
        <rect x="136" y="62" width="528" height="34" rx="2" fill="#04070c" />
        <g clipPath="url(#mt-board)">
          <g style={slide(-560, announcing ? 9 : 16)}>
            {[0, 1].map((copy) => (
              <text
                key={copy}
                x={140 + copy * 560}
                y="86"
                fontFamily="var(--f-mono)"
                fontSize="19"
                fontWeight="600"
                letterSpacing="1.5"
                fill={announcing ? '#fb923c' : '#fbbf24'}
              >
                {boardText}
              </text>
            ))}
          </g>
          {/* Dot-matrix texture over the text */}
          <rect
            x="136"
            y="62"
            width="528"
            height="34"
            fill="url(#mt-dots)"
            opacity="0.5"
            pointerEvents="none"
          />
        </g>
        <circle
          cx="672"
          cy="46"
          r="4"
          fill={announcing ? '#f87171' : '#38bdf8'}
          className={motionEnabled ? 'vm-blink' : undefined}
        />
      </Hotspot>
      <defs>
        <pattern id="mt-dots" width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill="#04070c" />
          <circle cx="1" cy="1" r="1" fill="transparent" />
          <path d="M0 0h3M0 0v3" stroke="#04070c" strokeWidth="1" opacity="0.85" />
        </pattern>
      </defs>

      {/* ── Route strip ─────────────────────────────────────────────────── */}
      <g>
        <path d="M176 128 h448" stroke="#1e3550" strokeWidth="4" strokeLinecap="round" />
        <path
          d={`M176 128 h${(448 / (STATIONS.length - 1)) * CURRENT_STATION}`}
          stroke="#38bdf8"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {STATIONS.map((station, index) => {
          const x = 176 + (448 / (STATIONS.length - 1)) * index;
          const active = index === CURRENT_STATION;
          return (
            <g key={station}>
              <circle
                cx={x}
                cy="128"
                r={active ? 7 : 4.5}
                fill={index <= CURRENT_STATION ? '#38bdf8' : '#0f1d2e'}
                stroke={active ? '#e0f2fe' : '#2a4763'}
                strokeWidth="2"
              />
              {active && motionEnabled && (
                <circle
                  cx={x}
                  cy="128"
                  r="11"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  style={{ animation: 'vm-pulse 2s ease-in-out infinite' }}
                />
              )}
              <text
                x={x}
                y="146"
                textAnchor="middle"
                fontFamily="var(--f-mono)"
                fontSize="8"
                letterSpacing="0.9"
                fill={active ? '#bae6fd' : '#5b7fa3'}
                opacity={active ? 1 : 0.55}
              >
                {station}
              </text>
            </g>
          );
        })}
      </g>

      {/* ── Window ───────────────────────────────────────────────────────── */}
      <g>
        <rect x="142" y="142" width="516" height="208" rx="20" fill="#0a1420" />
        <rect x="142" y="142" width="516" height="208" rx="20" fill="none" stroke="#24384f" strokeWidth="6" />
        <g clipPath="url(#mt-window)">
          <rect x="152" y="152" width="496" height="188" fill="#02050a" />

          {/* Tunnel wall */}
          <rect x="152" y="152" width="496" height="188" fill="#060d16" />
          <g style={slide(-248, 2.6)}>
            {Array.from({ length: 8 }, (_, index) => (
              <g key={index}>
                {/* Service lights */}
                <rect
                  x={152 + index * 62}
                  y="196"
                  width="5"
                  height="26"
                  rx="2.5"
                  fill="#fde68a"
                  opacity="0.85"
                />
                <rect
                  x={152 + index * 62 - 6}
                  y="196"
                  width="17"
                  height="26"
                  rx="8"
                  fill="#fbbf24"
                  opacity="0.16"
                />
                {/* Cable runs */}
                <path
                  d={`M${152 + index * 62} 250 q 31 14 62 0`}
                  stroke="#16283a"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d={`M${152 + index * 62} 268 q 31 12 62 0`}
                  stroke="#122031"
                  strokeWidth="2"
                  fill="none"
                />
              </g>
            ))}
          </g>

          {/* Fast light smears */}
          <g style={slide(-124, 0.85)} opacity="0.55">
            {Array.from({ length: 12 }, (_, index) => (
              <rect
                key={index}
                x={152 + index * 31}
                y={170 + ((index * 37) % 140)}
                width="26"
                height="2"
                rx="1"
                fill="#7dd3fc"
                opacity={0.25 + ((index * 17) % 50) / 100}
              />
            ))}
          </g>

          {/* Glass sheen + interior reflection */}
          <rect x="152" y="152" width="496" height="188" fill="url(#mt-glass)" />
          <path d="M152 340 L300 152 L370 152 L200 340 Z" fill="#ffffff" opacity="0.035" />
          {/* Ghost of a reflected passenger */}
          <g opacity="0.09" fill="#e0f2fe">
            <circle cx="560" cy="248" r="26" />
            <path d="M516 340 c 0 -44 20 -66 44 -66 c 24 0 44 22 44 66 z" />
          </g>
        </g>
      </g>

      {/* ── Handrail + straps ───────────────────────────────────────────── */}
      <rect x="60" y="176" width="72" height="7" rx="3.5" fill="#3d5670" />
      <rect x="668" y="176" width="72" height="7" rx="3.5" fill="#3d5670" />
      {[86, 700].map((x, index) => (
        <g
          key={x}
          style={
            motionEnabled
              ? ({
                  transformOrigin: `${x + 10}px 183px`,
                  animation: `vm-sway ${3.4 + index * 0.6}s ease-in-out ${index * 0.4}s infinite`,
                } as CSSProperties)
              : undefined
          }
        >
          <path d={`M${x + 10} 183 l0 44`} stroke="#2b3f56" strokeWidth="5" strokeLinecap="round" />
          <ellipse
            cx={x + 10}
            cy="240"
            rx="13"
            ry="16"
            fill="none"
            stroke="#4a6480"
            strokeWidth="5"
          />
        </g>
      ))}

      {/* ── Grab pole ───────────────────────────────────────────────────── */}
      <rect x="736" y="40" width="9" height="430" rx="4.5" fill="#3d5670" />
      <rect x="738" y="40" width="3" height="430" fill="#5f7d9c" opacity="0.6" />

      {/* ── Seats ───────────────────────────────────────────────────────── */}
      <g>
        <rect x="120" y="378" width="560" height="72" rx="10" fill="url(#mt-seat)" />
        <rect x="120" y="368" width="560" height="18" rx="9" fill="#26597e" />
        {[0, 1, 2, 3].map((index) => (
          <path
            key={index}
            d={`M${260 + index * 140} 378 l0 72`}
            stroke="#0f2b40"
            strokeWidth="3"
          />
        ))}
        <rect x="120" y="450" width="560" height="10" rx="5" fill="#0d2436" />
        {/* Priority seat sticker */}
        <rect x="134" y="392" width="40" height="26" rx="4" fill="#0e2a3e" stroke="#38bdf8" strokeWidth="1.5" />
        <circle cx="148" cy="401" r="3.5" fill="#38bdf8" />
        <path d="M143 416 c 0 -8 10 -8 10 0" stroke="#38bdf8" strokeWidth="2" fill="none" />
        <text x="160" y="410" fontFamily="var(--f-mono)" fontSize="7" fill="#38bdf8">
          PRI
        </text>
      </g>

      {/* Floor reflection of the window */}
      <rect x="200" y="470" width="400" height="60" fill="#38bdf8" opacity="0.05" />

      <rect x="0" y="0" width="800" height="560" fill="url(#mt-vig)" pointerEvents="none" />
    </svg>
  );
}
