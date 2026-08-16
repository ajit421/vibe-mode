import { useState, type CSSProperties } from 'react';
import { useToast } from '@/state/toast-context';
import { useVibe } from '@/state/vibe-context';
import { Hotspot } from './Hotspot';

/** Deliberately generic — the joke is that everyone already knows the song. */
const NOW_PLAYING = [
  'SABKO YE GAANA AATA HAI',
  'WOHI PURANA WALA',
  'VOLUME 30  ·  BASS +8',
  'PEECHE SE FARMAISH',
  'HIGHWAY WALA TRACK',
];

/** The car everyone piles into: aftermarket stereo, six speakers, no shame. */
export function GadiStereoVisual() {
  const { push } = useToast();
  const { motionEnabled } = useVibe();
  const [trackIndex, setTrackIndex] = useState(0);
  const [volume, setVolume] = useState(30);

  const bar = (index: number): CSSProperties =>
    motionEnabled
      ? {
          transformBox: 'fill-box',
          transformOrigin: 'center bottom',
          animation: `vm-eq ${0.7 + (index % 5) * 0.18}s ease-in-out ${index * 0.06}s infinite`,
        }
      : { transformBox: 'fill-box', transformOrigin: 'center bottom', transform: 'scaleY(0.6)' };

  return (
    <svg
      viewBox="0 0 800 560"
      className="h-full w-full"
      role="img"
      aria-label="The inside of a car at night: a bright aftermarket stereo with a spectrum display, a speedometer, a marigold garland on the mirror and truck-art patterns across the dashboard."
    >
      <defs>
        <linearGradient id="gd-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1038" />
          <stop offset="1" stopColor="#3a1140" />
        </linearGradient>
        <linearGradient id="gd-dash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241640" />
          <stop offset="0.5" stopColor="#150d29" />
          <stop offset="1" stopColor="#0a0618" />
        </linearGradient>
        <linearGradient id="gd-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6e1f5" />
          <stop offset="0.45" stopColor="#8d86ad" />
          <stop offset="0.55" stopColor="#5b5479" />
          <stop offset="1" stopColor="#c9c3e0" />
        </linearGradient>
        <clipPath id="gd-screen">
          <rect x="292" y="252" width="216" height="60" rx="4" />
        </clipPath>
        <radialGradient id="gd-vig" cx="0.5" cy="0.45" r="0.8">
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.62" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="800" height="560" fill="#0a0618" />

      {/* ── Windscreen: a bit of night highway ──────────────────────────── */}
      <g>
        <path d="M70 26 q 330 -22 660 0 l0 128 q -330 -20 -660 0z" fill="url(#gd-night)" />
        {/* Skyline */}
        <path
          d="M70 128 h48 v-26 h30 v18 h44 v-34 h34 v42 h56 v-22 h40 v30 h60 v-38 h36 v28 h52 v-18 h40 v34 h48 v-24 h42 v46 q -330 -20 -660 0z"
          fill="#150d29"
        />
        {/* Streetlight smears */}
        {Array.from({ length: 7 }, (_, index) => (
          <ellipse
            key={index}
            cx={120 + index * 96}
            cy={70 + ((index * 23) % 34)}
            rx="26"
            ry="3"
            fill={index % 2 ? '#facc15' : '#2dd4bf'}
            opacity="0.4"
            style={
              motionEnabled
                ? {
                    animation: `vm-marquee ${2 + (index % 3) * 0.7}s linear ${index * 0.3}s infinite`,
                  }
                : undefined
            }
          />
        ))}
        {/* Road strip at the base of the glass */}
        <path d="M70 138 q 330 -18 660 0 l0 16 q -330 -20 -660 0z" fill="#0d0820" />
      </g>
      <path d="M70 26 q 330 -22 660 0 l0 128 q -330 -20 -660 0z" fill="none" stroke="#120b24" strokeWidth="16" />
      <path d="M0 0 h800 v40 q -400 -26 -800 0z" fill="#0c0719" />

      {/* ── Mirror + marigold garland ───────────────────────────────────── */}
      <g>
        <rect x="344" y="22" width="112" height="28" rx="8" fill="#181031" stroke="#2b1d4d" />
        <rect x="351" y="27" width="98" height="18" rx="5" fill="#241a44" />
        <ellipse cx="380" cy="36" rx="12" ry="5" fill="#ff5da2" opacity="0.25" />
        {/* Garland draped over the mirror */}
        <path d="M344 44 q 56 46 112 0" stroke="#1f1540" strokeWidth="3" fill="none" />
        {Array.from({ length: 11 }, (_, index) => {
          const t = index / 10;
          const x = 344 + t * 112;
          const y = 44 + Math.sin(Math.PI * t) * 34;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={index % 2 ? 5.5 : 4.5}
              fill={index % 2 ? '#f59e0b' : '#fb923c'}
              opacity="0.95"
            />
          );
        })}
        {/* Hanging charm */}
        <g
          style={
            motionEnabled
              ? ({ transformOrigin: '400px 78px', animation: 'vm-sway 3.2s ease-in-out infinite' } as CSSProperties)
              : undefined
          }
        >
          <path d="M400 78 v22" stroke="#4a3a70" strokeWidth="2" />
          <path d="M400 100 l9 12 l-9 12 l-9 -12z" fill="#facc15" />
          <circle cx="400" cy="112" r="14" fill="#facc15" opacity="0.14" />
        </g>
      </g>

      {/* ── Dashboard ───────────────────────────────────────────────────── */}
      <path d="M0 168 q 400 -26 800 0 l0 392 l-800 0z" fill="url(#gd-dash)" />

      {/* Truck-art band across the dash */}
      <g>
        <path d="M0 182 q 400 -26 800 0 l0 22 q -400 -26 -800 0z" fill="#1d1138" />
        {Array.from({ length: 22 }, (_, index) => (
          <path
            key={index}
            d={`M${index * 38} ${186 + Math.sin(index * 0.6) * 3} l19 16 l19 -16`}
            fill="none"
            stroke={['#ff5da2', '#2dd4bf', '#facc15'][index % 3]}
            strokeWidth="2.5"
            opacity="0.65"
          />
        ))}
      </g>
      <text
        x="118"
        y="238"
        fontFamily="var(--f-heading)"
        fontSize="15"
        fontWeight="700"
        letterSpacing="2.5"
        fill="#facc15"
        opacity="0.8"
        transform="rotate(-2 118 238)"
      >
        HORN OK PLEASE
      </text>

      {/* ── Stereo head unit ────────────────────────────────────────────── */}
      <g>
        <rect x="270" y="228" width="266" height="152" rx="12" fill="url(#gd-chrome)" />
        <rect x="276" y="234" width="254" height="140" rx="9" fill="#0d0820" />

        {/* Display */}
        <Hotspot
          label="Change what is playing"
          onActivate={() => {
            setTrackIndex((current) => (current + 1) % NOW_PLAYING.length);
            push('Ye gaana toh sabko aata hai.', 'STEREO');
          }}
        >
          <rect x="288" y="248" width="224" height="68" rx="6" fill="#050310" stroke="#2b1d4d" />
          <g clipPath="url(#gd-screen)">
            <text
              x="300"
              y="272"
              fontFamily="var(--f-mono)"
              fontSize="12"
              fontWeight="600"
              letterSpacing="1"
              fill="#2dd4bf"
            >
              {NOW_PLAYING[trackIndex]}
            </text>
            {/* Spectrum analyser */}
            <g>
              {Array.from({ length: 26 }, (_, index) => (
                <rect
                  key={index}
                  x={300 + index * 8}
                  y="284"
                  width="5"
                  height="24"
                  rx="1"
                  fill={index % 7 === 0 ? '#facc15' : '#ff5da2'}
                  opacity="0.9"
                  style={bar(index)}
                />
              ))}
            </g>
          </g>
          <rect x="288" y="248" width="224" height="68" rx="6" fill="none" stroke="#3b2a63" />
        </Hotspot>

        {/* Buttons */}
        <g>
          {['◀◀', '▶', '▶▶', 'EQ', 'BT'].map((label, index) => (
            <g key={label}>
              <rect x={290 + index * 34} y="328" width="28" height="18" rx="4" fill="#1a1136" stroke="#31215a" />
              <text
                x={304 + index * 34}
                y="341"
                textAnchor="middle"
                fontFamily="var(--f-mono)"
                fontSize="8"
                fill="#a597c6"
              >
                {label}
              </text>
            </g>
          ))}
        </g>

        {/* Volume knob */}
        <Hotspot
          label={`Volume knob — currently ${volume}`}
          onActivate={() => {
            setVolume((current) => (current >= 40 ? 12 : current + 7));
            push(volume >= 40 ? 'Theek hai, thoda kam kar diya.' : 'Bass thoda aur badha bhai.', 'VOLUME');
          }}
        >
          <circle cx="486" cy="342" r="26" fill="#1a1136" stroke="#3b2a63" strokeWidth="2" />
          <circle cx="486" cy="342" r="20" fill="#0d0820" />
          {/* Level ring */}
          <circle
            cx="486"
            cy="342"
            r="23"
            fill="none"
            stroke="#ff5da2"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(volume / 50) * 108} 200`}
            transform="rotate(-215 486 342)"
          />
          <text x="486" y="346" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="11" fill="#f7f1ff">
            {volume}
          </text>
        </Hotspot>

        <text x="403" y="368" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="7" fill="#6b5a94" letterSpacing="2">
          BASS BOOST · 6 SPEAKER
        </text>
      </g>

      {/* ── AC vents ────────────────────────────────────────────────────── */}
      {[188, 570].map((x) => (
        <g key={x}>
          <rect x={x} y="252" width="62" height="42" rx="7" fill="#120b26" stroke="#2b1d4d" />
          {[0, 1, 2, 3].map((index) => (
            <rect key={index} x={x + 6} y={258 + index * 9} width="50" height="4" rx="2" fill="#241a44" />
          ))}
        </g>
      ))}

      {/* ── Speedometer ─────────────────────────────────────────────────── */}
      <g>
        <circle cx="646" cy="404" r="74" fill="#100a22" stroke="#2b1d4d" strokeWidth="4" />
        <circle cx="646" cy="404" r="62" fill="#0a0618" />
        {Array.from({ length: 11 }, (_, index) => {
          const angle = (-215 + index * 25) * (Math.PI / 180);
          const major = index % 2 === 0;
          return (
            <g key={index}>
              <path
                d={`M${646 + Math.cos(angle) * 54} ${404 + Math.sin(angle) * 54} L${646 + Math.cos(angle) * (major ? 44 : 48)} ${404 + Math.sin(angle) * (major ? 44 : 48)}`}
                stroke={index > 7 ? '#ff5da2' : '#6b5a94'}
                strokeWidth={major ? 2.5 : 1.5}
              />
              {major && (
                <text
                  x={646 + Math.cos(angle) * 34}
                  y={404 + Math.sin(angle) * 34 + 3}
                  textAnchor="middle"
                  fontFamily="var(--f-mono)"
                  fontSize="8"
                  fill="#8877b8"
                >
                  {index * 20}
                </text>
              )}
            </g>
          );
        })}
        {/* Needle at ~80 km/h */}
        <path d="M646 404 L594 366" stroke="#ff5da2" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="646" cy="404" r="7" fill="#2dd4bf" />
        <text x="646" y="446" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8" fill="#6b5a94" letterSpacing="1.5">
          KM/H
        </text>
      </g>

      {/* ── Door speaker ────────────────────────────────────────────────── */}
      <Hotspot label="Tap the door speaker" onActivate={() => push('Poori gadi gaa rahi hai.', 'SPEAKER')}>
        <circle cx="118" cy="410" r="66" fill="#150d29" stroke="#2b1d4d" strokeWidth="3" />
        <circle cx="118" cy="410" r="52" fill="#0e0822" />
        <g stroke="#241a44" strokeWidth="2" fill="none">
          <circle cx="118" cy="410" r="44" />
          <circle cx="118" cy="410" r="34" />
        </g>
        <circle
          cx="118"
          cy="410"
          r="22"
          fill="#2b1d4d"
          style={
            motionEnabled
              ? ({
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: 'vm-pulse 0.55s ease-in-out infinite',
                } as CSSProperties)
              : undefined
          }
        />
        <circle cx="118" cy="410" r="9" fill="#ff5da2" opacity="0.8" />
      </Hotspot>

      {/* ── Steering wheel (right-hand drive) ───────────────────────────── */}
      <g>
        <ellipse cx="640" cy="556" rx="132" ry="82" fill="none" stroke="#150d29" strokeWidth="20" />
        <ellipse cx="640" cy="556" rx="132" ry="82" fill="none" stroke="#2b1d4d" strokeWidth="5" />
        <rect x="600" y="506" width="80" height="34" rx="9" fill="#1a1136" />
        <text x="640" y="528" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="#ff5da2" letterSpacing="1.5">
          HORN
        </text>
      </g>

      <rect x="0" y="0" width="800" height="560" fill="url(#gd-vig)" pointerEvents="none" />
    </svg>
  );
}
