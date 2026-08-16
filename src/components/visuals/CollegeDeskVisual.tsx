import { useState, type CSSProperties } from 'react';
import { useToast } from '@/state/toast-context';
import { useVibe } from '@/state/vibe-context';
import { EMPTY_ITEMS, useRotator } from '@/hooks/useRotator';
import { Hotspot } from './Hotspot';

/** The view from the last bench: blackboard up front, carved desk in the way. */
export function CollegeDeskVisual() {
  const { push } = useToast();
  const { theme, motionEnabled } = useVibe();
  const board = useRotator(theme.ticker ?? EMPTY_ITEMS, { intervalMs: 4600 });
  const [shared, setShared] = useState(false);

  return (
    <svg
      viewBox="0 0 800 560"
      className="h-full w-full"
      role="img"
      aria-label="A classroom seen from the back bench: a green blackboard with chalk writing, and a carved wooden desk holding an open notebook, a phone with a shared earphone splitter and a water bottle."
    >
      <defs>
        <linearGradient id="cl-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3128" />
          <stop offset="1" stopColor="#141a14" />
        </linearGradient>
        <linearGradient id="cl-board" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#26402f" />
          <stop offset="1" stopColor="#16281d" />
        </linearGradient>
        <linearGradient id="cl-desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9713c" />
          <stop offset="0.1" stopColor="#8a5a2e" />
          <stop offset="1" stopColor="#4d3119" />
        </linearGradient>
        <linearGradient id="cl-window" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dbeafe" stopOpacity="0.9" />
          <stop offset="1" stopColor="#a7c7e7" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="cl-vig" cx="0.5" cy="0.42" r="0.8">
          <stop offset="0.52" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="800" height="560" fill="url(#cl-wall)" />

      {/* ── Window with afternoon light ─────────────────────────────────── */}
      <g>
        <rect x="24" y="76" width="104" height="150" rx="3" fill="#101610" stroke="#2f382d" strokeWidth="5" />
        <rect x="31" y="83" width="90" height="136" fill="url(#cl-window)" opacity="0.55" />
        <path d="M76 83 v136M31 151 h90" stroke="#2f382d" strokeWidth="4" />
        {/* A tree outside, because there always is one */}
        <circle cx="58" cy="120" r="20" fill="#4a7a4a" opacity="0.5" />
        <circle cx="96" cy="134" r="15" fill="#4a7a4a" opacity="0.4" />
      </g>
      <path d="M128 90 L340 366 L150 366 L60 210 Z" fill="#f7f3d8" opacity="0.05" />

      {/* ── Blackboard ──────────────────────────────────────────────────── */}
      <Hotspot label="Read the blackboard" onActivate={() => push(board.item ?? '> kuch samajh nahi aaya', 'BOARD')}>
        <rect x="168" y="56" width="592" height="256" rx="6" fill="#3a2a18" />
        <rect x="180" y="68" width="568" height="232" rx="3" fill="url(#cl-board)" />

        {/* Chalk smears from a lazy duster */}
        <g fill="#e8eee4" opacity="0.07">
          <rect x="196" y="90" width="220" height="42" rx="20" />
          <rect x="430" y="180" width="280" height="54" rx="26" />
          <rect x="210" y="240" width="180" height="36" rx="18" />
        </g>

        <g fontFamily="var(--f-mono)" fill="#e8eee4">
          <text x="206" y="106" fontSize="17" opacity="0.92" letterSpacing="1">
            UNIT 4 — IMPORTANT
          </text>
          <path d="M206 114 h198" stroke="#e8eee4" strokeWidth="1.5" opacity="0.55" />

          <text x="206" y="146" fontSize="12" opacity="0.66">
            (sir ne kaha tha exam mein aayega)
          </text>

          <text x="206" y="196" fontSize="13" opacity="0.8">
            ATTENDANCE :
          </text>
          <text x="330" y="196" fontSize="14" fill="#f0a52c" opacity="0.95">
            61%
          </text>
          <text x="206" y="220" fontSize="11" opacity="0.5">
            (75% chahiye)
          </text>

          {/* Half-erased diagram nobody copied */}
          <g stroke="#e8eee4" strokeWidth="1.6" fill="none" opacity="0.5">
            <rect x="470" y="96" width="86" height="54" />
            <path d="M470 150 l86 -54M556 96 l40 30 l0 54 l-40 -30z" />
            <path d="M470 96 l40 30 l86 0" />
            <path d="M596 180 l-40 30 l-86 0" strokeDasharray="4 4" />
          </g>
          <text x="470" y="238" fontSize="10" opacity="0.42">
            fig 4.2 — “simple hai”
          </text>

          {/* Today's rotating line, in chalk */}
          <text x="206" y="272" fontSize="11" fill="#6ee7b7" opacity="0.75">
            {(board.item ?? '').slice(0, 52)}
          </text>
        </g>

        {/* Chalk tray */}
        <rect x="180" y="300" width="568" height="12" rx="3" fill="#4a3620" />
        <rect x="240" y="296" width="30" height="7" rx="3.5" fill="#f1efe4" />
        <rect x="278" y="297" width="18" height="6" rx="3" fill="#f8d9a0" />
        <rect x="640" y="292" width="52" height="14" rx="3" fill="#2f2418" />
        <rect x="640" y="292" width="52" height="6" rx="3" fill="#5c4a30" />
      </Hotspot>

      {/* ── Wall clock, watched constantly ──────────────────────────────── */}
      <g>
        <circle cx="96" cy="290" r="30" fill="#171d16" stroke="#3a4438" strokeWidth="3" />
        <circle cx="96" cy="290" r="24" fill="#e8ece4" />
        <path d="M96 290 v-15" stroke="#22281f" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M96 290 l13 7" stroke="#22281f" strokeWidth="2" strokeLinecap="round" />
        <circle cx="96" cy="290" r="2.5" fill="#c0392b" />
      </g>

      {/* ── Desk ────────────────────────────────────────────────────────── */}
      <g>
        <path d="M40 366 l720 0 l0 22 l-720 0z" fill="url(#cl-desk)" />
        <path d="M40 388 l720 0 l0 130 l-720 0z" fill="#6b4526" />
        <path d="M40 388 l720 0 l0 6 l-720 0z" fill="#3a2312" opacity="0.6" />
        {/* Plank seams */}
        <g stroke="#5a3a1f" strokeWidth="2" opacity="0.7">
          <path d="M40 430 h720" />
          <path d="M40 474 h720" />
        </g>

        {/* Carvings, the real syllabus */}
        <g stroke="#3f2814" strokeWidth="2" fill="none" opacity="0.75">
          <path d="M96 452 l0 -18 l10 0 M96 444 l8 0" />
          <text x="118" y="452" fontFamily="var(--f-mono)" fontSize="15" fill="#3f2814" stroke="none">
            2K24
          </text>
          <path d="M212 448 c -6 -8 -18 -2 -9 7 l9 9 l9 -9 c 9 -9 -3 -15 -9 -7z" />
          <text x="560" y="452" fontFamily="var(--f-mono)" fontSize="14" fill="#3f2814" stroke="none">
            BORED
          </text>
          <path d="M660 438 h44 M660 446 h30" />
        </g>
      </g>

      {/* ── Notebook ────────────────────────────────────────────────────── */}
      <Hotspot label="Look at the notebook" onActivate={() => push('Notes? Ye toh sirf doodles hain.', 'NOTEBOOK')}>
        <g transform="rotate(-3 300 330)">
          <rect x="196" y="278" width="208" height="104" rx="3" fill="#f4f1e2" />
          <rect x="196" y="278" width="208" height="104" rx="3" fill="none" stroke="#d8d2bd" />
          {/* Ruled lines */}
          <g stroke="#b9cbe0" strokeWidth="1">
            {Array.from({ length: 7 }, (_, index) => (
              <path key={index} d={`M204 ${294 + index * 12} h192`} />
            ))}
          </g>
          <path d="M228 278 v104" stroke="#e5a3a3" strokeWidth="1.2" />
          {/* Spiral binding */}
          <g stroke="#9aa0a6" strokeWidth="2.5" fill="none">
            {Array.from({ length: 8 }, (_, index) => (
              <path key={index} d={`M${212 + index * 24} 272 q 6 10 0 16`} />
            ))}
          </g>
          {/* One real line, then doodles */}
          <text x="236" y="303" fontFamily="var(--f-mono)" fontSize="8.5" fill="#3f4a5a">
            Unit 4 — important
          </text>
          <g stroke="#3f4a5a" strokeWidth="1.4" fill="none" opacity="0.8">
            {/* Impossible cube */}
            <path d="M244 322 h26 v22 h-26z" />
            <path d="M252 314 h26 v22 M278 314 l-8 8 M278 336 l-8 8" />
            {/* Spiral */}
            <path d="M330 330 c 0 -8 -12 -8 -12 0 c 0 12 20 12 20 -2 c 0 -18 -28 -18 -28 4" />
            {/* Stick figure */}
            <circle cx="372" cy="318" r="6" />
            <path d="M372 324 v16 M366 330 h12 M372 340 l-6 10 M372 340 l6 10" />
          </g>
          <text x="236" y="372" fontFamily="var(--f-mono)" fontSize="7.5" fill="#8a93a0">
            (baaki kal likh lenge)
          </text>
        </g>
        {/* Pen */}
        <g transform="rotate(24 430 356)">
          <rect x="398" y="352" width="72" height="7" rx="3.5" fill="#1f5fa8" />
          <rect x="464" y="353" width="14" height="5" rx="2.5" fill="#cfd6dd" />
          <rect x="398" y="352" width="16" height="7" rx="3.5" fill="#123f74" />
        </g>
      </Hotspot>

      {/* ── Phone with the shared earphones ─────────────────────────────── */}
      <Hotspot
        label="Share an earphone"
        onActivate={() => {
          setShared((current) => !current);
          push(shared ? 'Theek hai, dono kaan mere.' : 'Ek earphone tu le, ek main.', 'MUSIC');
        }}
      >
        <g transform="rotate(8 540 336)">
          <rect x="504" y="292" width="72" height="88" rx="9" fill="#15181c" />
          <rect x="509" y="297" width="62" height="78" rx="6" fill="#0c1a16" />
          {/* Tiny now-playing UI */}
          <rect x="516" y="304" width="48" height="26" rx="3" fill="#1d3a2e" />
          <path d="M534 311 l12 6 l-12 6z" fill="#6ee7b7" />
          <g fill="#6ee7b7" opacity="0.85">
            {Array.from({ length: 9 }, (_, index) => (
              <rect
                key={index}
                x={517 + index * 5.4}
                y={340}
                width="3"
                height="14"
                rx="1.5"
                style={
                  motionEnabled
                    ? ({
                        transformBox: 'fill-box',
                        transformOrigin: 'center bottom',
                        animation: `vm-eq ${0.8 + (index % 4) * 0.2}s ease-in-out ${index * 0.07}s infinite`,
                      } as CSSProperties)
                    : { transformBox: 'fill-box', transformOrigin: 'center bottom', transform: 'scaleY(0.5)' }
                }
              />
            ))}
          </g>
          <rect x="516" y="360" width="48" height="3" rx="1.5" fill="#2a4a3c" />
          <rect x="516" y="360" width="30" height="3" rx="1.5" fill="#6ee7b7" />
        </g>

        {/* Splitter and two cables heading opposite ways */}
        <circle cx="560" cy="384" r="6" fill="#2b2f34" />
        <path
          d="M560 384 C 520 404 470 396 436 414"
          stroke="#e8e4d8"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={shared ? 'M560 384 C 606 404 656 398 700 418' : 'M560 384 C 596 400 606 424 588 442'}
          stroke="#e8e4d8"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          style={{ transition: 'd 300ms ease' }}
        />
        <circle cx="436" cy="414" r="5" fill="#e8e4d8" />
        <circle cx={shared ? 700 : 588} cy={shared ? 418 : 442} r="5" fill="#e8e4d8" />
      </Hotspot>

      {/* ── Water bottle ────────────────────────────────────────────────── */}
      <g>
        <rect x="676" y="288" width="34" height="86" rx="10" fill="#7fb3d5" opacity="0.65" />
        <rect x="676" y="288" width="34" height="86" rx="10" fill="none" stroke="#5b90b3" opacity="0.6" />
        <rect x="676" y="330" width="34" height="44" rx="8" fill="#4a90c2" opacity="0.5" />
        <rect x="684" y="272" width="18" height="18" rx="4" fill="#2f6f9e" />
        <rect x="678" y="316" width="30" height="12" fill="#f0a52c" opacity="0.55" />
      </g>

      {/* ── Bag slung on the desk edge ──────────────────────────────────── */}
      <g>
        <path d="M60 396 c 0 -30 22 -40 40 -40 c 18 0 40 10 40 40 l0 62 l-80 0z" fill="#274150" />
        <path d="M68 420 l64 0 l0 20 l-64 0z" fill="#31596d" />
        <path d="M84 356 c 0 -12 32 -12 32 0" stroke="#3d6b83" strokeWidth="4" fill="none" />
        <circle cx="100" cy="430" r="3.5" fill="#f0a52c" opacity="0.8" />
      </g>

      <rect x="0" y="0" width="800" height="560" fill="url(#cl-vig)" pointerEvents="none" />
    </svg>
  );
}
