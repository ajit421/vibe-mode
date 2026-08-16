import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useVibe } from '@/state/vibe-context';
import { emitVibeEvent } from '@/utils/events';
import { cn } from '@/utils/cn';

interface HotspotProps {
  label: string;
  onActivate: () => void;
  children: ReactNode;
  className?: string;
}

/** How long a ripple lives, in sync with the `vm-ripple` keyframes. */
const RIPPLE_MS = 620;

/**
 * A clickable region inside a scene SVG. Keyboard-reachable and labelled, so
 * the little easter eggs are not mouse-only.
 *
 * Now that the scenes are the page background, a press needs to acknowledge
 * itself on the spot — the toast alone appears at the other end of the screen
 * and reads as unrelated. So each activation drops a ring at the point you
 * actually touched, which is also the only feedback a touch user gets, having
 * no hover state at all.
 */
export function Hotspot({ label, onActivate, children, className }: HotspotProps) {
  const { motionEnabled } = useVibe();
  const groupRef = useRef<SVGGElement>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    },
    [],
  );

  const ripple = useCallback(
    (clientX?: number, clientY?: number) => {
      if (!motionEnabled) return;
      const group = groupRef.current;
      const svg = group?.ownerSVGElement;
      if (!group || !svg) return;

      // Ripples are drawn in the SVG's own user units, so the click point has
      // to come back through the current viewport transform — the scene is
      // scaled and cropped to fill the window, so screen pixels are not user
      // units and a raw clientX/Y would land somewhere else entirely.
      const box = group.getBBox();
      let x = box.x + box.width / 2;
      let y = box.y + box.height / 2;

      const matrix = svg.getScreenCTM();
      if (clientX !== undefined && clientY !== undefined && matrix) {
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const local = point.matrixTransform(matrix.inverse());
        x = local.x;
        y = local.y;
      }

      const id = nextId.current++;
      setRipples((current) => [...current, { id, x, y }]);
      timers.current.push(
        window.setTimeout(
          () => setRipples((current) => current.filter((item) => item.id !== id)),
          RIPPLE_MS,
        ),
      );
    },
    [motionEnabled],
  );

  return (
    <g
      ref={groupRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      className={cn(
        'vm-hotspot cursor-pointer origin-center',
        'hover:brightness-125 focus-visible:brightness-125',
        className,
      )}
      onClick={(event) => {
        ripple(event.clientX, event.clientY);
        emitVibeEvent('interact');
        onActivate();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        ripple();
        emitVibeEvent('interact');
        onActivate();
      }}
    >
      <title>{label}</title>
      {children}

      {ripples.map((item) => (
        <g key={item.id} className="pointer-events-none" aria-hidden="true">
          <circle
            cx={item.x}
            cy={item.y}
            r="16"
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="2.5"
            style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `vm-ripple ${RIPPLE_MS}ms ease-out forwards` }}
          />
          <circle
            cx={item.x}
            cy={item.y}
            r="16"
            fill="var(--c-accent)"
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animation: `vm-ripple-fill ${RIPPLE_MS}ms ease-out forwards`,
            }}
          />
        </g>
      ))}
    </g>
  );
}
