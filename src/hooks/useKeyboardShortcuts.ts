import { useEffect, useRef } from 'react';

export type ShortcutHandler = (event: KeyboardEvent) => void;

/**
 * Combos are lowercase and normalised, e.g. `space`, `arrowleft`, `m`, `?`,
 * `escape`, `mod+k` (ctrl on Windows/Linux, cmd on macOS).
 */
export type ShortcutMap = Record<string, ShortcutHandler>;

/** Combos that still fire while a text field has focus. */
const ALWAYS_ACTIVE = new Set(['escape', 'mod+k']);

/**
 * Keys the browser already gives meaning to on a focused control — Space
 * presses a button, arrows move a slider. Stealing these would break keyboard
 * navigation, so they yield whenever such a control has focus.
 */
const YIELDS_TO_CONTROLS = new Set([
  'space',
  'enter',
  'arrowleft',
  'arrowright',
  'arrowup',
  'arrowdown',
]);

const NATIVE_CONTROL = 'button, a[href], [role="button"], [role="switch"], [tabindex]:not([tabindex="-1"])';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function isNativeControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(NATIVE_CONTROL) !== null;
}

function comboFor(event: KeyboardEvent): string {
  const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
  const mod = event.ctrlKey || event.metaKey ? 'mod+' : '';
  return `${mod}${key}`;
}

export function useKeyboardShortcuts(map: ShortcutMap, enabled = true): void {
  // Handlers are re-created every render; a ref keeps the listener stable so
  // we're not tearing down and re-attaching on each keystroke.
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) return;

      const combo = comboFor(event);
      const handler = mapRef.current[combo];
      if (!handler) return;

      if (isEditable(event.target) && !ALWAYS_ACTIVE.has(combo)) return;
      if (YIELDS_TO_CONTROLS.has(combo) && isNativeControl(event.target)) return;

      // Only claim the event once we know we're handling it, so browser
      // shortcuts we don't map keep working.
      event.preventDefault();
      handler(event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
