import { useState, type CSSProperties } from 'react';
import { useToast } from '@/state/toast-context';
import { useVibe } from '@/state/vibe-context';
import { EMPTY_ITEMS, useRotator } from '@/hooks/useRotator';
import { Hotspot } from './Hotspot';

const VOLTAGES = ['240.1', '229.8', '0.00', '3.31', '11.98', '5.02', '—.——'];

/**
 * The flagship scene: a rented-room desk at 2am. Front elevation, one warm
 * lamp doing all the lighting, and roughly six months of unfinished projects.
 */
export function JudaadDeskVisual() {
  const { push } = useToast();
  const { theme, motionEnabled } = useVibe();
  const [voltage, setVoltage] = useState(0);
  const [lamp, setLamp] = useState<'on' | 'off'>('on');

  const terminalLines = theme.ticker ?? EMPTY_ITEMS;
  const terminal = useRotator(terminalLines, { intervalMs: 3400 });
  const lampOn = lamp === 'on';

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
      aria-label="A messy engineering desk in a rented room at night: a laptop, a circuit board, a multimeter, tools and a cup of chai."
    >
      <defs>
        <linearGradient id="jd-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241a14" />
          <stop offset="1" stopColor="#140f0c" />
        </linearGradient>
        <linearGradient id="jd-desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b4030" />
          <stop offset="0.06" stopColor="#7a5740" />
          <stop offset="1" stopColor="#3a2a20" />
        </linearGradient>
        <radialGradient id="jd-lamp" cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="#f5a524" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#f5a524" stopOpacity="0.14" />
          <stop offset="1" stopColor="#f5a524" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="jd-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1a17" />
          <stop offset="1" stopColor="#08110f" />
        </linearGradient>
        <clipPath id="jd-screen-clip">
          <rect x="316" y="214" width="176" height="112" rx="3" />
        </clipPath>
      </defs>

      {/* ── Room ─────────────────────────────────────────────────────────── */}
      <rect x="0" y="0" width="800" height="430" fill="url(#jd-wall)" />
      <rect x="0" y="430" width="800" height="130" fill="#100b09" />

      {/* Damp patch, because of course there is one. */}
      <ellipse cx="120" cy="70" rx="86" ry="44" fill="#2e2118" opacity="0.55" />
      <ellipse cx="112" cy="64" rx="52" ry="26" fill="#3a2a1d" opacity="0.4" />

      {/* Lamp light cone */}
      {lampOn && (
        <>
          <path d="M660 96 L820 430 L400 430 Z" fill="url(#jd-lamp)" />
          <ellipse cx="560" cy="404" rx="260" ry="46" fill="#f5a524" opacity="0.07" />
        </>
      )}

      {/* ── Wall: engineering drawing ───────────────────────────────────── */}
      <g opacity={lampOn ? 0.85 : 0.5}>
        <rect x="60" y="118" width="150" height="112" rx="2" fill="#0f2231" stroke="#1d3d55" />
        <g stroke="#4a8fb5" strokeWidth="1" fill="none" opacity="0.8">
          <rect x="76" y="136" width="60" height="44" />
          <path d="M76 158h60M106 136v44" strokeDasharray="3 3" />
          <circle cx="168" cy="158" r="20" />
          <circle cx="168" cy="158" r="8" />
          <path d="M76 196h118M76 192v8M194 192v8" />
        </g>
        <text x="82" y="216" fill="#4a8fb5" fontSize="9" fontFamily="var(--f-mono)">
          REV. 07 — “final”
        </text>
        {/* Tape */}
        <rect x="120" y="112" width="30" height="12" fill="#d9cdb8" opacity="0.35" transform="rotate(-6 135 118)" />
      </g>

      {/* ── Wall: sticky notes ──────────────────────────────────────────── */}
      <g>
        {[
          { x: 246, y: 128, r: -5, fill: '#e8d44d', line1: 'RENT', line2: 'kal pakka' },
          { x: 330, y: 148, r: 4, fill: '#f0a3c0', line1: 'WIFI PW', line2: 'jugaad@123' },
          { x: 246, y: 214, r: 3, fill: '#8fd4a8', line1: 'DO NOT', line2: 'touch relay' },
        ].map((note) => (
          <g key={note.line1} transform={`rotate(${note.r} ${note.x + 32} ${note.y + 30})`}>
            <rect
              x={note.x}
              y={note.y}
              width="64"
              height="60"
              fill={note.fill}
              opacity={lampOn ? 0.92 : 0.6}
            />
            <path d={`M${note.x} ${note.y + 60} l64 0 l0 -8 l-64 8z`} fill="#000" opacity="0.12" />
            <text x={note.x + 8} y={note.y + 24} fontSize="10" fontFamily="var(--f-mono)" fill="#2a2419">
              {note.line1}
            </text>
            <text x={note.x + 8} y={note.y + 40} fontSize="9" fontFamily="var(--f-mono)" fill="#4a412f">
              {note.line2}
            </text>
          </g>
        ))}
      </g>

      {/* ── Wall: poster ────────────────────────────────────────────────── */}
      <g opacity={lampOn ? 0.9 : 0.55}>
        <rect x="440" y="112" width="132" height="86" rx="2" fill="#1b1a2e" stroke="#2f2d4a" />
        <text x="506" y="150" textAnchor="middle" fontSize="15" fontFamily="var(--f-heading)" fontWeight="700" fill="#f5a524">
          JUGAAD
        </text>
        <text x="506" y="168" textAnchor="middle" fontSize="10" fontFamily="var(--f-mono)" fill="#8f8bb5">
          &gt; PERFECTION
        </text>
        <path d="M456 180h100" stroke="#5eead4" strokeWidth="1" opacity="0.5" />
      </g>

      {/* ── Wall: switchboard with far too much plugged in ──────────────── */}
      <g>
        <rect x="612" y="228" width="58" height="76" rx="4" fill="#1c1713" stroke="#33291f" />
        {[0, 1, 2].map((row) => (
          <g key={row}>
            <rect x="622" y={240 + row * 22} width="16" height="12" rx="2" fill="#0d0a08" />
            <rect x="646" y={240 + row * 22} width="14" height="12" rx="2" fill="#0d0a08" />
            <rect x="622" y={240 + row * 22} width="16" height="3" rx="1.5" fill={row === 1 ? '#86efac' : '#2a221a'} />
          </g>
        ))}
        {/* Wires drooping out of it */}
        <path d="M630 306 C 626 350 604 356 588 392" stroke="#231c16" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M654 306 C 662 344 690 352 700 392" stroke="#2b2119" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M640 306 C 636 340 560 358 540 392" stroke="#1e1913" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>

      {/* ── Table lamp ──────────────────────────────────────────────────── */}
      <Hotspot label={lampOn ? 'Turn the lamp off' : 'Turn the lamp on'} onActivate={() => {
        setLamp((current) => (current === 'on' ? 'off' : 'on'));
        push(lampOn ? 'Light band kar, aankh dukh rahi hai.' : 'Theek hai, wapas on.', 'LAMP');
      }}>
        <path d="M700 392 l0 -6 l-34 0 l0 6z" fill="#2a211a" />
        <rect x="674" y="300" width="6" height="92" rx="3" fill="#332820" />
        <path d="M638 96 l50 0 l24 46 l-98 0z" fill="#3a2c22" stroke="#4a382b" />
        <path d="M614 142 l98 0 l-8 8 l-82 0z" fill={lampOn ? '#f7c46a' : '#2a2119'} />
        <path d="M680 142 C 690 220 686 280 678 302" stroke="#332820" strokeWidth="5" fill="none" />
        {lampOn && <circle cx="663" cy="146" r="16" fill="#f5a524" opacity="0.35" />}
      </Hotspot>

      {/* ── Desk ─────────────────────────────────────────────────────────── */}
      <rect x="40" y="386" width="720" height="14" rx="3" fill="url(#jd-desk)" />
      <rect x="40" y="400" width="720" height="26" fill="#2e2118" />
      <rect x="40" y="400" width="720" height="4" fill="#000" opacity="0.25" />
      <rect x="78" y="426" width="14" height="112" fill="#241a13" />
      <rect x="708" y="426" width="14" height="112" fill="#241a13" />

      {/* ── Laptop ──────────────────────────────────────────────────────── */}
      <Hotspot
        label="Look at the laptop"
        onActivate={() => push(terminal.item ?? '> still compiling…', 'TERMINAL')}
      >
        {/* Lid */}
        <path d="M310 208 l188 0 l0 124 l-188 0z" fill="#1a1a1c" stroke="#2c2c30" strokeWidth="2" />
        <rect x="316" y="214" width="176" height="112" rx="3" fill="url(#jd-screen)" />
        <g clipPath="url(#jd-screen-clip)">
          <rect x="316" y="214" width="176" height="112" fill="#0a1512" />
          {/* Terminal output */}
          <text x="324" y="232" fontSize="8.5" fontFamily="var(--f-mono)" fill="#5eead4" opacity="0.75">
            judaad@house:~$
          </text>
          {terminalLines.slice(0, 4).map((line, index) => (
            <text
              key={line}
              x="324"
              y={248 + index * 13}
              fontSize="8"
              fontFamily="var(--f-mono)"
              fill="#86efac"
              opacity={index === terminal.index % 4 ? 0.95 : 0.32}
            >
              {line.length > 30 ? `${line.slice(0, 29)}…` : line}
            </text>
          ))}
          <text x="324" y="313" fontSize="8.5" fontFamily="var(--f-mono)" fill="#5eead4">
            $
          </text>
          <rect
            x="336"
            y="306"
            width="6"
            height="9"
            fill="#86efac"
            className={motionEnabled ? 'vm-caret' : undefined}
          />
        </g>
        {/* Screen sheen */}
        <path d="M316 214 l60 0 l-40 112 l-20 0z" fill="#ffffff" opacity="0.03" />
        {/* Base */}
        <path d="M296 332 l216 0 l14 22 l-244 0z" fill="#232326" />
        <path d="M296 332 l216 0 l3 4 l-222 0z" fill="#34343a" />
        <rect x="366" y="344" width="76" height="4" rx="2" fill="#17171a" />
      </Hotspot>

      {/* ── PCB + breadboard ────────────────────────────────────────────── */}
      <Hotspot
        label="Poke the circuit board"
        onActivate={() => push('Bhai ye wire kidhar ja raha hai?', 'PCB')}
      >
        <rect x="528" y="352" width="112" height="34" rx="2" fill="#123524" stroke="#1d5138" />
        <g fill="#c8b273" opacity="0.85">
          {Array.from({ length: 9 }, (_, index) => (
            <rect key={index} x={536 + index * 12} y="378" width="7" height="4" rx="1" />
          ))}
        </g>
        <g stroke="#2f7a55" strokeWidth="1.2" fill="none" opacity="0.9">
          <path d="M534 360h32v10h24" />
          <path d="M534 372h20v-8h18" />
          <path d="M600 358v14h32" />
        </g>
        <rect x="566" y="358" width="22" height="14" rx="1" fill="#0b0b0c" />
        {[0, 1, 2].map((index) => (
          <circle
            key={index}
            cx={604 + index * 12}
            cy="364"
            r="2.6"
            fill={['#86efac', '#f5a524', '#f87171'][index]}
            className={motionEnabled ? 'vm-blink' : undefined}
            style={{ animationDelay: `${index * 0.45}s` }}
          />
        ))}
      </Hotspot>

      {/* ── Multimeter ──────────────────────────────────────────────────── */}
      <Hotspot
        label="Take a reading with the multimeter"
        onActivate={() => {
          setVoltage((current) => (current + 1) % VOLTAGES.length);
          push('Ek baar aur test kar.', 'MULTIMETER');
        }}
      >
        <rect x="92" y="316" width="86" height="70" rx="7" fill="#c9541f" />
        <rect x="92" y="316" width="86" height="70" rx="7" fill="none" stroke="#8f3a13" />
        <rect x="100" y="324" width="70" height="26" rx="3" fill="#1d2b25" />
        <text x="166" y="343" textAnchor="end" fontSize="15" fontFamily="var(--f-mono)" fill="#5eead4">
          {VOLTAGES[voltage]}
        </text>
        <text x="104" y="343" fontSize="7" fontFamily="var(--f-mono)" fill="#5eead4" opacity="0.6">
          V~
        </text>
        <circle cx="135" cy="368" r="12" fill="#2a2320" stroke="#1a1512" />
        <path d="M135 368 l0 -9" stroke="#e8d44d" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="108" cy="382" r="3" fill="#1a1512" />
        <circle cx="162" cy="382" r="3" fill="#1a1512" />
        {/* Probe leads trailing off the desk */}
        <path d="M108 386 C 96 420 120 430 96 452" stroke="#b91c1c" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M162 386 C 176 418 150 432 172 456" stroke="#141414" strokeWidth="3" fill="none" strokeLinecap="round" />
      </Hotspot>

      {/* ── Chai ────────────────────────────────────────────────────────── */}
      <Hotspot label="Pick up the chai" onActivate={() => push('Chai required.', 'CHAI')}>
        {motionEnabled && (
          <g opacity={0.5}>
            {[0, 1, 2].map((index) => (
              <path
                key={index}
                d="M0 0 c -4 -10 4 -16 0 -26"
                transform={`translate(${232 + index * 9} 352)`}
                stroke="#f6f1e8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                style={
                  {
                    animation: `vm-steam ${2.8 + index * 0.5}s ease-out ${index * 0.7}s infinite`,
                    '--vm-dx': `${index * 4 - 4}px`,
                  } as CSSProperties
                }
              />
            ))}
          </g>
        )}
        <path d="M216 354 l44 0 l-5 32 l-34 0z" fill="#e6e0d4" />
        <path d="M216 354 l44 0 l-1.5 10 l-41 0z" fill="#c9c1b2" />
        <path d="M260 360 c 14 0 14 18 0 18" stroke="#e6e0d4" strokeWidth="4" fill="none" />
        <ellipse cx="238" cy="356" rx="21" ry="4" fill="#8a5a2b" />
      </Hotspot>

      {/* ── Tools ───────────────────────────────────────────────────────── */}
      <Hotspot
        label="Grab the screwdriver"
        onActivate={() => push('Jugaad mode activated.', 'JUGAAD')}
      >
        <g transform="rotate(-14 350 378)">
          <rect x="300" y="374" width="52" height="9" rx="4" fill="#e8b04b" />
          <rect x="300" y="374" width="52" height="4" rx="2" fill="#f5cd85" />
          <rect x="352" y="377" width="40" height="3" rx="1.5" fill="#9aa3ad" />
          <rect x="390" y="375.5" width="8" height="6" rx="1" fill="#c3ccd6" />
        </g>
        <g transform="rotate(9 232 380)">
          <path d="M196 380 l30 -6 l14 4 l-30 8z" fill="#7c8894" />
          <path d="M240 378 l26 4 l0 6 l-26 -2z" fill="#b91c1c" />
        </g>
      </Hotspot>

      {/* ── Extension board, doing all the work ─────────────────────────── */}
      <Hotspot
        label="Look at the extension board"
        onActivate={() => push('Extension board pe aur kuch mat lagana.', 'DANGER')}
      >
        <rect x="96" y="446" width="132" height="26" rx="5" fill="#1e1a16" stroke="#2f2720" />
        {[0, 1, 2, 3].map((index) => (
          <rect key={index} x={106 + index * 30} y="452" width="18" height="14" rx="2" fill="#0c0a08" />
        ))}
        <circle
          cx="218"
          cy="459"
          r="3"
          fill="#f87171"
          className={motionEnabled ? 'vm-blink' : undefined}
        />
        <path d="M96 460 C 60 460 52 494 24 500" stroke="#241d17" strokeWidth="6" fill="none" strokeLinecap="round" />
      </Hotspot>

      {/* ── Backpack on the floor ───────────────────────────────────────── */}
      <g>
        <path d="M292 480 c 0 -34 22 -46 42 -46 c 20 0 42 12 42 46 l0 44 l-84 0z" fill="#22303c" />
        <path d="M300 496 l68 0 l0 20 l-68 0z" fill="#2c3e4d" />
        <path d="M320 434 c 0 -12 28 -12 28 0" stroke="#3a5063" strokeWidth="4" fill="none" />
        <circle cx="334" cy="506" r="3" fill="#5eead4" opacity="0.7" />
      </g>

      {/* ── Floor cable spaghetti ───────────────────────────────────────── */}
      <g stroke="#1b1611" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.9">
        <path d="M420 520 C 470 500 520 536 580 512" />
        <path d="M448 536 C 512 520 548 544 620 528" />
      </g>

      {/* Vignette so the scene sits into the page */}
      <rect x="0" y="0" width="800" height="560" fill="url(#jd-vig)" pointerEvents="none" />
      <defs>
        <radialGradient id="jd-vig" cx="0.52" cy="0.45" r="0.75">
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
      </defs>
    </svg>
  );
}
