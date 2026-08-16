import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useToast } from '@/state/toast-context';
import { useVibe } from '@/state/vibe-context';
import { subscribeVibeEvent } from '@/utils/events';
import { Hotspot } from './Hotspot';

const ROUTES = [
  { id: 'a', d: 'M604 452 q -22 -34 -58 -30 q -40 5 -46 -30 q -6 -34 -44 -30', eta: '18 min' },
  { id: 'b', d: 'M604 452 q -46 -8 -56 -38 q -10 -30 -50 -22 q -34 7 -42 -30', eta: '24 min' },
  { id: 'c', d: 'M604 452 q -14 -40 -54 -40 q -44 0 -40 -34 q 4 -30 -38 -18', eta: '31 min' },
] as const;

/** Back seat of a cab on a wet city night, looking out through the windscreen. */
export function CabWindowVisual() {
  const { push } = useToast();
  const { motionEnabled } = useVibe();
  const [routeIndex, setRouteIndex] = useState(0);
  const route = ROUTES[routeIndex];

  const reroute = () => {
    setRouteIndex((current) => (current + 1) % ROUTES.length);
    push('Rerouting… the long way, obviously.', 'NAV');
  };

  const rerouteRef = useRef(reroute);
  rerouteRef.current = reroute;
  useEffect(() => subscribeVibeEvent('reroute', () => rerouteRef.current()), []);

  const approach = (dx: number, dy: number, seconds: number, delay: number): CSSProperties =>
    motionEnabled
      ? ({
          animation: `vm-approach ${seconds}s linear ${delay}s infinite`,
          transformBox: 'fill-box',
          transformOrigin: 'center',
          '--vm-ax': `${dx}px`,
          '--vm-ay': `${dy}px`,
        } as CSSProperties)
      : { opacity: 0.4 };

  return (
    <svg
      viewBox="0 0 800 560"
      // Fills the screen and crops, rather than letterboxing: this scene is
      // the page background now, so it must cover whatever shape the window is.
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      // `group`, not `img` — `img` makes descendants presentational, hiding the
      // Hotspots from screen readers while they stay keyboard-focusable.
      role="group"
      aria-label="The view from the back seat of a cab at night: a rainy windscreen, city lights streaking past, and a navigation screen on the dashboard."
    >
      <defs>
        <linearGradient id="cb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#160f2b" />
          <stop offset="0.55" stopColor="#241539" />
          <stop offset="1" stopColor="#3a1d3f" />
        </linearGradient>
        <linearGradient id="cb-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1526" />
          <stop offset="1" stopColor="#0a0710" />
        </linearGradient>
        <linearGradient id="cb-dash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#191228" />
          <stop offset="1" stopColor="#0a0713" />
        </linearGradient>
        <clipPath id="cb-glass">
          <path d="M92 74 q 308 -26 616 0 l24 292 l-664 0z" />
        </clipPath>
        <radialGradient id="cb-vig" cx="0.5" cy="0.42" r="0.8">
          <stop offset="0.48" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.62" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="800" height="560" fill="#08050f" />

      {/* ── Through the windscreen ──────────────────────────────────────── */}
      <g clipPath="url(#cb-glass)">
        <rect x="60" y="60" width="680" height="320" fill="url(#cb-sky)" />

        {/* Skyline, two layers for depth */}
        <g fill="#150e24" opacity="0.95">
          <path d="M60 250 h58 v-56 h34 v34 h44 v-72 h40 v94 h52 v-44 h46 v56 h60 v-84 h38 v64 h50 v-40 h42 v76 h56 v-52 h40 v124 h-560z" />
        </g>
        <g fill="#1e1436">
          <path d="M60 268 h44 v-40 h30 v28 h50 v-52 h34 v64 h46 v-30 h50 v42 h44 v-56 h36 v48 h54 v-34 h40 v58 h44 v-26 h36 v96 h-508z" />
        </g>
        {/* Lit windows */}
        <g fill="#fde047" opacity="0.5">
          {Array.from({ length: 46 }, (_, index) => (
            <rect
              key={index}
              x={78 + ((index * 61) % 640)}
              y={210 + ((index * 37) % 100)}
              width="4"
              height="6"
              opacity={((index * 13) % 10) / 12 + 0.15}
            />
          ))}
        </g>

        {/* Road */}
        <path d="M60 300 l680 0 l0 80 l-680 0z" fill="url(#cb-road)" />
        <path d="M370 296 L104 380 L696 380 L430 296 Z" fill="#120d1c" />

        {/* Lane dashes rushing at the camera */}
        {Array.from({ length: 6 }, (_, index) => (
          <g key={index} transform="translate(400 300)">
            <g
              style={
                motionEnabled
                  ? ({
                      animation: `vm-road-dash 1.5s linear ${index * 0.25}s infinite`,
                      transformBox: 'fill-box',
                      transformOrigin: 'center top',
                      '--vm-road-y': '96px',
                    } as CSSProperties)
                  : { opacity: 0.35 }
              }
            >
              <rect x="-3" y="0" width="6" height="16" rx="1" fill="#e9d5ff" opacity="0.8" />
            </g>
          </g>
        ))}

        {/* Streetlights sweeping past */}
        {Array.from({ length: 4 }, (_, index) => (
          <g key={`l${index}`} transform="translate(392 268)">
            <g style={approach(-330, 110, 2.4, index * 0.6)}>
              <rect x="-2" y="0" width="4" height="34" fill="#2a2038" />
              <ellipse cx="0" cy="-2" rx="7" ry="4" fill="#fde047" opacity="0.95" />
              <ellipse cx="0" cy="-2" rx="18" ry="12" fill="#fde047" opacity="0.2" />
            </g>
          </g>
        ))}
        {Array.from({ length: 4 }, (_, index) => (
          <g key={`r${index}`} transform="translate(408 268)">
            <g style={approach(330, 110, 2.4, 0.3 + index * 0.6)}>
              <rect x="-2" y="0" width="4" height="34" fill="#2a2038" />
              <ellipse cx="0" cy="-2" rx="7" ry="4" fill="#e879f9" opacity="0.9" />
              <ellipse cx="0" cy="-2" rx="18" ry="12" fill="#e879f9" opacity="0.2" />
            </g>
          </g>
        ))}

        {/* Tail lights of the car in front */}
        <g opacity="0.9">
          <ellipse cx="368" cy="322" rx="9" ry="4" fill="#f43f5e" />
          <ellipse cx="436" cy="322" rx="9" ry="4" fill="#f43f5e" />
          <ellipse cx="368" cy="322" rx="20" ry="11" fill="#f43f5e" opacity="0.22" />
          <ellipse cx="436" cy="322" rx="20" ry="11" fill="#f43f5e" opacity="0.22" />
        </g>

        {/* Wet road reflections */}
        <g opacity="0.35">
          {Array.from({ length: 9 }, (_, index) => (
            <rect
              key={index}
              x={110 + index * 68}
              y={332 + (index % 3) * 14}
              width="34"
              height="2"
              rx="1"
              fill={index % 2 ? '#e879f9' : '#38bdf8'}
              opacity="0.5"
            />
          ))}
        </g>

        {/* Rain on the glass */}
        <g>
          {Array.from({ length: 26 }, (_, index) => {
            const x = 84 + ((index * 97) % 640);
            return (
              <ellipse
                key={index}
                cx={x}
                cy={90 + ((index * 53) % 270)}
                rx="1.6"
                ry="3"
                fill="#dbeafe"
                opacity="0.22"
              />
            );
          })}
          {motionEnabled &&
            Array.from({ length: 7 }, (_, index) => (
              <rect
                key={`s${index}`}
                x={120 + index * 92}
                y="60"
                width="1.6"
                height="26"
                rx="0.8"
                fill="#dbeafe"
                style={
                  {
                    animation: `vm-rain ${1.4 + (index % 3) * 0.4}s linear ${index * 0.35}s infinite`,
                    '--vm-peak': '0.4',
                  } as CSSProperties
                }
              />
            ))}
        </g>

        {/* Glass sheen */}
        <path d="M92 74 L300 74 L150 366 L68 366 Z" fill="#ffffff" opacity="0.035" />
      </g>

      {/* ── Wiper ───────────────────────────────────────────────────────── */}
      <g transform="translate(300 372)">
        <g
          style={
            motionEnabled
              ? ({
                  animation: 'vm-wipe 6.5s ease-in-out infinite',
                  transformBox: 'fill-box',
                  transformOrigin: '4px 96%',
                } as CSSProperties)
              : { transform: 'rotate(5deg)' }
          }
        >
          <rect x="0" y="-230" width="7" height="232" rx="3" fill="#131018" opacity="0.9" />
          <rect x="-3" y="-232" width="13" height="150" rx="4" fill="#1c1824" opacity="0.85" />
        </g>
      </g>

      {/* ── Windscreen frame ────────────────────────────────────────────── */}
      <path
        d="M92 74 q 308 -26 616 0 l24 292 l-664 0z"
        fill="none"
        stroke="#100c18"
        strokeWidth="18"
      />
      <path d="M0 0 h800 v78 q -400 -34 -800 0z" fill="#0d0a14" />

      {/* ── Rear-view mirror ────────────────────────────────────────────── */}
      <g>
        <rect x="336" y="52" width="128" height="34" rx="9" fill="#15111f" stroke="#241c33" />
        <rect x="344" y="58" width="112" height="22" rx="6" fill="#221a33" />
        <ellipse cx="392" cy="69" rx="14" ry="7" fill="#e879f9" opacity="0.22" />
        <ellipse cx="428" cy="69" rx="9" ry="5" fill="#38bdf8" opacity="0.18" />
        {/* Hanging charm */}
        <g
          style={
            motionEnabled
              ? ({
                  transformOrigin: '400px 86px',
                  animation: 'vm-sway 3.6s ease-in-out infinite',
                } as CSSProperties)
              : undefined
          }
        >
          <path d="M400 86 l0 26" stroke="#3b2f4f" strokeWidth="2" />
          <circle cx="400" cy="120" r="8" fill="#fde047" opacity="0.8" />
          <circle cx="400" cy="120" r="14" fill="#fde047" opacity="0.12" />
        </g>
      </g>

      {/* ── Dashboard ───────────────────────────────────────────────────── */}
      <path d="M0 366 q 400 -22 800 0 l0 194 l-800 0z" fill="url(#cb-dash)" />
      <path d="M0 366 q 400 -22 800 0 l0 8 q -400 -22 -800 0z" fill="#2a2140" opacity="0.6" />

      {/* Vents */}
      <g>
        <rect x="96" y="416" width="98" height="34" rx="6" fill="#0e0b16" stroke="#231b35" />
        {[0, 1, 2, 3].map((index) => (
          <rect key={index} x="104" y={422 + index * 7} width="82" height="3" rx="1.5" fill="#241c36" />
        ))}
      </g>

      {/* ── Navigation screen ───────────────────────────────────────────── */}
      <Hotspot label="Change the route" onActivate={reroute}>
        <rect x="424" y="392" width="228" height="132" rx="10" fill="#0b0814" stroke="#2b2142" strokeWidth="2" />
        <rect x="432" y="400" width="212" height="116" rx="6" fill="#0f0a1b" />

        {/* Map grid */}
        <g stroke="#1d1630" strokeWidth="1">
          {Array.from({ length: 6 }, (_, index) => (
            <path key={`h${index}`} d={`M432 ${412 + index * 18} h212`} />
          ))}
          {Array.from({ length: 8 }, (_, index) => (
            <path key={`v${index}`} d={`M${444 + index * 26} 400 v116`} />
          ))}
        </g>

        {/* Route */}
        <path
          key={route.id}
          d={route.d}
          fill="none"
          stroke="#e879f9"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="10 8"
          style={
            motionEnabled
              ? ({ animation: 'vm-dash 2.4s linear infinite', '--vm-dash-to': '-108' } as CSSProperties)
              : undefined
          }
        />
        <circle cx="604" cy="452" r="6" fill="#38bdf8" />
        <circle cx="604" cy="452" r="11" fill="#38bdf8" opacity="0.25" />
        {/* Destination pin */}
        <path
          d="M462 392 c -8 0 -14 6 -14 13 c 0 10 14 23 14 23 s 14 -13 14 -23 c 0 -7 -6 -13 -14 -13z"
          fill="#fde047"
        />
        <circle cx="462" cy="405" r="4.5" fill="#0f0a1b" />

        {/* ETA panel */}
        <rect x="432" y="400" width="86" height="34" rx="5" fill="#120c20" opacity="0.92" />
        <text x="440" y="414" fontFamily="var(--f-mono)" fontSize="7.5" fill="#9e93b9" letterSpacing="1">
          ETA
        </text>
        <text x="440" y="428" fontFamily="var(--f-mono)" fontSize="13" fontWeight="600" fill="#e879f9">
          {route.eta}
        </text>
        <text x="530" y="510" fontFamily="var(--f-mono)" fontSize="7.5" fill="#6f6491" letterSpacing="1">
          DOESN’T MATTER
        </text>
      </Hotspot>

      {/* ── Steering wheel (right-hand drive) ───────────────────────────── */}
      <g opacity="0.95">
        <ellipse cx="176" cy="540" rx="112" ry="70" fill="none" stroke="#171122" strokeWidth="16" />
        <ellipse cx="176" cy="540" rx="112" ry="70" fill="none" stroke="#241b36" strokeWidth="4" />
        <rect x="146" y="500" width="60" height="30" rx="8" fill="#1b1428" />
        <circle cx="176" cy="515" r="5" fill="#e879f9" opacity="0.5" />
      </g>

      <rect x="0" y="0" width="800" height="560" fill="url(#cb-vig)" pointerEvents="none" />
    </svg>
  );
}
