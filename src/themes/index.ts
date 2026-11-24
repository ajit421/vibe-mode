import type { VibeTheme } from '@/types/theme';
import { judaadHouse } from './judaad-house';
import { metro } from './metro';
import { indianTrain } from './indian-train';
import { cabWala } from './cab-wala';
import { office } from './office';
import { radioWala } from './radio-wala';
import { gadiWala } from './gadi-wala';
import { college } from './college';

/* ══════════════════════════════════════════════════════════════════════════
 *  THEME REGISTRY
 *
 *  Adding a mode is a two-step job:
 *    1. Create `src/themes/<your-mode>.ts` exporting a `VibeTheme`.
 *    2. Import it and drop it in the array below.
 *
 *  Everything else — the mode picker, keyboard shortcut, ?mode= URL, SEO
 *  title, playlist wiring, colours — is derived from this array at runtime.
 *  Order matters: it is the order shown in the picker and the order the
 *  number-key shortcuts (1…9) follow.
 * ══════════════════════════════════════════════════════════════════════════ */
export const THEMES: readonly VibeTheme[] = [
  judaadHouse,
  metro,
  indianTrain,
  cabWala,
  office,
  radioWala,
  gadiWala,
  college,
];

export const DEFAULT_THEME_ID = judaadHouse.id;

/**
 * Where a first-time visitor starts, by the hour on their own clock — so the
 * landing screen opens on a place that fits the moment instead of always the
 * same one. Only for a first visit: anyone with a saved mode, or a `?mode=`
 * link, gets exactly what they asked for.
 */
export function suggestedThemeId(hour: number): string {
  if (hour >= 5 && hour < 8) return indianTrain.id; // sunrise, window seat
  if (hour >= 8 && hour < 11) return metro.id; // the commute
  if (hour >= 11 && hour < 17) return office.id; // working hours
  if (hour >= 17 && hour < 20) return gadiWala.id; // the drive home
  if (hour >= 20 && hour < 23) return cabWala.id; // the city at night
  return judaadHouse.id; // 11pm to 5am belongs to the house
}

// Looking a mode up by id or alias happens over the *listener's* list (their
// own modes included) — see `findIn` in `themes/customize.ts`.
