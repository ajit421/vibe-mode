import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useToast } from '@/state/toast-context';
import { useVibe } from '@/state/vibe-context';
import { subscribeVibeEvent } from '@/utils/events';
import { Hotspot } from './Hotspot';

const STATIONS = [
  { freq: '91.1', name: 'Purane Nagme' },
  { freq: '93.5', name: 'Filmi Hits' },
  { freq: '98.3', name: 'Aapka Apna Station' },
  { freq: '104.0', name: 'Retro Mirchi' },
  { freq: '107.2', name: 'Shaam Ki Baithak' },
] as const;

/** Dial geometry — the needle travels between these two x positions. */
const DIAL_LEFT = 440;
const DIAL_RIGHT = 646;

/** A wooden valve radio on a table, dial glowing, dust in the lamp light. */
export function RadioSetVisual() {
  const { push } = useToast();
  const { motionEnabled } = useVibe();
  const [stationIndex, setStationIndex] = useState(2);
  const station = STATIONS[stationIndex];

  const tune = () => {
    setStationIndex((current) => {
      const next = (current + 1) % STATIONS.length;
      push(`${STATIONS[next].freq} FM — ${STATIONS[next].name}`, 'TUNED');
      return next;
    });
  };

  // `T` from the shell tunes as well; the ref keeps the listener stable.
  const tuneRef = useRef(tune);
  tuneRef.current = tune;
  useEffect(() => subscribeVibeEvent('tune', () => tuneRef.current()), []);

  const needleX = DIAL_LEFT + ((DIAL_RIGHT - DIAL_LEFT) / (STATIONS.length - 1)) * stationIndex;

  return (
    <svg
      viewBox="0 0 800 560"
      className="h-full w-full"
      // `group`, not `img` — `img` makes descendants presentational, hiding the
      // Hotspots from screen readers while they stay keyboard-focusable.
      role="group"
      aria-label="A wooden valve radio on a table: a woven speaker grille, a glowing tuning dial with a red needle, three bakelite knobs and a telescopic antenna."
    >
      <defs>
        <linearGradient id="rd-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1b12" />
          <stop offset="1" stopColor="#120c08" />
        </linearGradient>
        <linearGradient id="rd-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c4f2c" />
          <stop offset="0.14" stopColor="#613c21" />
          <stop offset="0.82" stopColor="#4a2d18" />
          <stop offset="1" stopColor="#33200f" />
        </linearGradient>
        <linearGradient id="rd-dial" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbe3a8" />
          <stop offset="0.5" stopColor="#f2c46a" />
          <stop offset="1" stopColor="#d99b3c" />
        </linearGradient>
        <radialGradient id="rd-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e9a13b" stopOpacity="0.42" />
          <stop offset="1" stopColor="#e9a13b" stopOpacity="0" />
        </radialGradient>
        <pattern id="rd-weave" width="9" height="9" patternUnits="userSpaceOnUse">
          <rect width="9" height="9" fill="#3a2416" />
          <path d="M0 4.5h9M4.5 0v9" stroke="#5c3b22" strokeWidth="3" />
          <path d="M0 4.5h9" stroke="#2a1a0f" strokeWidth="1" />
        </pattern>
        <radialGradient id="rd-vig" cx="0.5" cy="0.45" r="0.78">
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
      </defs>

      {/* ── Room ─────────────────────────────────────────────────────────── */}
      <rect x="0" y="0" width="800" height="560" fill="url(#rd-wall)" />
      {/* Faded wallpaper stripes */}
      <g opacity="0.16">
        {Array.from({ length: 13 }, (_, index) => (
          <rect key={index} x={index * 64} y="0" width="26" height="480" fill="#4a3120" />
        ))}
      </g>
      {/* Warm bloom around the set */}
      <ellipse cx="400" cy="300" rx="330" ry="250" fill="url(#rd-glow)" />

      {/* ── Antenna ──────────────────────────────────────────────────────── */}
      <Hotspot
        label="Adjust the antenna"
        onActivate={() => push('Antenna theek kar diya. Ab clear hai.', 'ANTENNA')}
      >
        <path d="M622 140 L716 34" stroke="#8a8f96" strokeWidth="5" strokeLinecap="round" />
        <path d="M660 98 L716 34" stroke="#b9bec6" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="717" cy="33" r="5" fill="#d6dbe2" />
        <circle cx="622" cy="140" r="7" fill="#3a2416" stroke="#6b4527" />
      </Hotspot>

      {/* ── Cabinet ──────────────────────────────────────────────────────── */}
      <rect x="118" y="132" width="564" height="336" rx="26" fill="url(#rd-wood)" />
      <rect x="118" y="132" width="564" height="336" rx="26" fill="none" stroke="#8a5c33" strokeWidth="2" opacity="0.5" />
      {/* Wood grain */}
      <g stroke="#3d2413" strokeWidth="1" opacity="0.35" fill="none">
        <path d="M140 176 q 260 -20 520 6" />
        <path d="M136 250 q 280 22 528 -10" />
        <path d="M142 344 q 250 -18 512 12" />
        <path d="M138 424 q 268 20 520 -8" />
      </g>
      {/* Top highlight */}
      <rect x="130" y="140" width="540" height="8" rx="4" fill="#a06f3f" opacity="0.35" />

      {/* ── Speaker grille ───────────────────────────────────────────────── */}
      <Hotspot
        label="Tap the speaker"
        onActivate={() => push('Thoda sa static hai, chalega.', 'SPEAKER')}
      >
        <rect x="150" y="176" width="238" height="252" rx="14" fill="#241609" />
        <rect x="158" y="184" width="222" height="236" rx="10" fill="url(#rd-weave)" />
        <rect x="158" y="184" width="222" height="236" rx="10" fill="none" stroke="#c99a4e" strokeWidth="2.5" opacity="0.75" />
        {/* Gold cross-bars */}
        <g stroke="#c99a4e" strokeWidth="3" opacity="0.55">
          <path d="M158 262 h222" />
          <path d="M158 342 h222" />
        </g>
        {/* Sound rings */}
        {motionEnabled &&
          [0, 1, 2].map((index) => (
            <circle
              key={index}
              cx="269"
              cy="302"
              r="34"
              fill="none"
              stroke="#e9a13b"
              strokeWidth="2"
              opacity="0"
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                animation: `vm-ring 3s ease-out ${index}s infinite`,
              }}
            />
          ))}
      </Hotspot>

      {/* ── Brand plate ──────────────────────────────────────────────────── */}
      <g>
        <rect x="196" y="440" width="146" height="20" rx="4" fill="#2a1a0d" />
        <text
          x="269"
          y="454"
          textAnchor="middle"
          fontFamily="var(--f-heading)"
          fontSize="12"
          fontWeight="700"
          letterSpacing="5"
          fill="#c99a4e"
        >
          SANGEET
        </text>
      </g>

      {/* ── Tuning dial ──────────────────────────────────────────────────── */}
      <Hotspot label={`Tune the dial — currently ${station.freq} FM`} onActivate={tune}>
        <rect x="418" y="176" width="246" height="108" rx="8" fill="#1c1108" />
        <rect x="426" y="184" width="230" height="92" rx="5" fill="url(#rd-dial)" />

        {/* Frequency scale */}
        <g fontFamily="var(--f-mono)" fontSize="9" fill="#4a2f12">
          {STATIONS.map((entry, index) => {
            const x = DIAL_LEFT + ((DIAL_RIGHT - DIAL_LEFT) / (STATIONS.length - 1)) * index;
            return (
              <g key={entry.freq}>
                <path d={`M${x} 196 v12`} stroke="#5c3a17" strokeWidth="1.5" />
                <text x={x} y="222" textAnchor="middle">
                  {entry.freq}
                </text>
              </g>
            );
          })}
          {/* Minor ticks */}
          {Array.from({ length: 21 }, (_, index) => (
            <path
              key={index}
              d={`M${434 + index * 10.6} 196 v6`}
              stroke="#6b4720"
              strokeWidth="1"
              opacity="0.5"
            />
          ))}
        </g>

        <text x="436" y="268" fontFamily="var(--f-mono)" fontSize="8.5" fill="#6b4720" letterSpacing="1.5">
          FM
        </text>
        <text
          x="646"
          y="268"
          textAnchor="end"
          fontFamily="var(--f-mono)"
          fontSize="9"
          fill="#4a2f12"
          letterSpacing="0.5"
        >
          {station.name}
        </text>

        {/* Needle */}
        <g style={{ transition: 'transform 420ms cubic-bezier(0.22,1,0.36,1)', transform: `translateX(${needleX - DIAL_LEFT}px)` }}>
          <path d={`M${DIAL_LEFT} 188 v84`} stroke="#c0392b" strokeWidth="2.5" />
          <path d={`M${DIAL_LEFT} 188 l-5 -7 l10 0z`} fill="#c0392b" />
        </g>

        {/* Dial glass */}
        <path d="M426 184 l70 0 l-46 92 l-24 0z" fill="#ffffff" opacity="0.22" />
      </Hotspot>

      {/* ── Magic-eye tube ───────────────────────────────────────────────── */}
      <g>
        <circle cx="440" cy="318" r="20" fill="#10201a" stroke="#3a2416" strokeWidth="3" />
        <path
          d="M440 318 m -13 0 a 13 13 0 1 1 26 0 a 13 13 0 1 1 -26 0"
          fill="#7fd1ae"
          opacity="0.2"
        />
        <path
          d="M440 318 L427 306 A 18 18 0 0 1 453 306 Z"
          fill="#7fd1ae"
          opacity="0.85"
          style={
            motionEnabled
              ? ({
                  transformBox: 'fill-box',
                  transformOrigin: 'center bottom',
                  animation: 'vm-pulse 1.3s ease-in-out infinite',
                } as CSSProperties)
              : undefined
          }
        />
        <text x="440" y="352" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="7" fill="#8a6a44" letterSpacing="1">
          TUNE
        </text>
      </g>

      {/* ── Knobs ────────────────────────────────────────────────────────── */}
      {[
        { x: 512, label: 'VOL', message: 'Volume dheere — mummy so rahi hai.', angle: -38 },
        { x: 588, label: 'TONE', message: 'Bass thoda badha diya.', angle: 22 },
        { x: 646, label: 'BAND', message: 'FM · AM · Short wave. Teenon try kar liye.', angle: 62 },
      ].map((knob) => (
        <Hotspot key={knob.label} label={`Turn the ${knob.label} knob`} onActivate={() => push(knob.message, knob.label)}>
          <circle cx={knob.x} cy={396} r="27" fill="#1d1109" />
          <circle cx={knob.x} cy={394} r="25" fill="#33200f" stroke="#6b4527" strokeWidth="2" />
          <circle cx={knob.x} cy={394} r="17" fill="#432a14" />
          {/* Fluted edge */}
          <g stroke="#5c3b22" strokeWidth="1.5">
            {Array.from({ length: 12 }, (_, index) => {
              const a = (index / 12) * Math.PI * 2;
              return (
                <path
                  key={index}
                  d={`M${knob.x + Math.cos(a) * 19} ${394 + Math.sin(a) * 19} L${knob.x + Math.cos(a) * 24} ${394 + Math.sin(a) * 24}`}
                />
              );
            })}
          </g>
          <path
            d={`M${knob.x} 394 L${knob.x + Math.cos((knob.angle * Math.PI) / 180) * 15} ${394 + Math.sin((knob.angle * Math.PI) / 180) * 15}`}
            stroke="#e9a13b"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text x={knob.x} y="438" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="7.5" fill="#a5825a" letterSpacing="1.4">
            {knob.label}
          </text>
        </Hotspot>
      ))}

      {/* ── Table + cloth ────────────────────────────────────────────────── */}
      <path d="M60 468 l680 0 l0 14 l-680 0z" fill="#4a2d18" />
      <path d="M40 482 l720 0 l0 16 l-720 0z" fill="#2f1c0e" />
      {/* Lace edge */}
      <g fill="#d9c9a8" opacity="0.5">
        {Array.from({ length: 30 }, (_, index) => (
          <circle key={index} cx={62 + index * 24} cy="482" r="6" />
        ))}
        <rect x="56" y="466" width="688" height="16" opacity="0.35" />
      </g>
      {/* Legs */}
      <rect x="132" y="498" width="16" height="62" fill="#25160b" />
      <rect x="652" y="498" width="16" height="62" fill="#25160b" />

      <rect x="0" y="0" width="800" height="560" fill="url(#rd-vig)" pointerEvents="none" />
    </svg>
  );
}
