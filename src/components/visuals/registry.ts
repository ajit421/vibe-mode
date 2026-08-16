import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { AbstractVisual } from './AbstractVisual';

type VisualLoader = () => Promise<{ default: ComponentType }>;

/* ══════════════════════════════════════════════════════════════════════════
 *  CENTRAL VISUAL REGISTRY
 *
 *  A theme references its scene by id (`hero.visual`). Each scene is code-split
 *  so a visitor only downloads the world they are actually looking at.
 *
 *  To give a new theme bespoke artwork: drop a component in this folder and add
 *  one line here. To skip artwork entirely, use any id you like — unknown ids
 *  resolve to `AbstractVisual`, which paints itself from the theme's colours.
 * ══════════════════════════════════════════════════════════════════════════ */
const LOADERS: Record<string, VisualLoader> = {
  'judaad-desk': () =>
    import('./JudaadDeskVisual').then((module) => ({ default: module.JudaadDeskVisual })),
  'metro-coach': () =>
    import('./MetroCoachVisual').then((module) => ({ default: module.MetroCoachVisual })),
  'train-window': () =>
    import('./TrainWindowVisual').then((module) => ({ default: module.TrainWindowVisual })),
  'cab-window': () =>
    import('./CabWindowVisual').then((module) => ({ default: module.CabWindowVisual })),
  'office-desk': () =>
    import('./OfficeDeskVisual').then((module) => ({ default: module.OfficeDeskVisual })),
  'radio-set': () =>
    import('./RadioSetVisual').then((module) => ({ default: module.RadioSetVisual })),
  'gadi-stereo': () =>
    import('./GadiStereoVisual').then((module) => ({ default: module.GadiStereoVisual })),
  'college-desk': () =>
    import('./CollegeDeskVisual').then((module) => ({ default: module.CollegeDeskVisual })),
};

const CACHE = new Map<string, LazyExoticComponent<ComponentType>>();

export function getVisual(id: string): ComponentType {
  const loader = LOADERS[id];
  if (!loader) return AbstractVisual;

  let component = CACHE.get(id);
  if (!component) {
    component = lazy(loader);
    CACHE.set(id, component);
  }
  return component;
}

/** Warms a scene's chunk — called when a mode card is hovered or focused. */
export function preloadVisual(id: string): void {
  void LOADERS[id]?.();
}

export function hasVisual(id: string): boolean {
  return id in LOADERS;
}
