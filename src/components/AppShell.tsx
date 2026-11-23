import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, m } from 'motion/react';
import { useVibe } from '@/state/vibe-context';
import { usePlayer } from '@/state/player-context';
import { useKeyboardShortcuts, type ShortcutMap } from '@/hooks/useKeyboardShortcuts';
import { ThemeBackground } from '@/components/theme/ThemeBackground';
import { SceneBackground } from '@/components/theme/SceneBackground';
import { TransitionOverlay } from '@/components/theme/TransitionOverlay';
import { ModeSelectorOverlay } from '@/components/theme/ModeSelectorOverlay';
import { AmbientEffects } from '@/components/effects/AmbientEffects';
import { TopBar } from '@/components/layout/TopBar';
import { MusicPlayer } from '@/components/player/MusicPlayer';
import { SettingsPanel } from '@/components/panels/SettingsPanel';
import { ShortcutsPanel } from '@/components/panels/ShortcutsPanel';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { Landing } from '@/components/screens/Landing';
import { World } from '@/components/screens/World';

// Only people who customise need the editor, so it is its own chunk, fetched on
// first open — everyone else never downloads it.
const CustomizePanel = lazy(() =>
  import('@/components/panels/CustomizePanel').then((module) => ({
    default: module.CustomizePanel,
  })),
);

// The per-mode keys (A to announce, R to reroute, T to tune) are gone with the
// drawn scenes — they drove animations inside those illustrations, and there is
// nothing left for them to talk to now that the background is a picture.

export function AppShell() {
  const { themes, theme, hasEntered, enter, selectorOpen, setSelectorOpen, motionEnabled } =
    useVibe();
  const player = usePlayer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // Once loaded it stays mounted, so the modal can animate out when closed.
  const [customizeLoaded, setCustomizeLoaded] = useState(false);
  useEffect(() => {
    if (customizeOpen) setCustomizeLoaded(true);
  }, [customizeOpen]);

  const anyOverlayOpen = settingsOpen || shortcutsOpen || customizeOpen || selectorOpen;

  const shortcuts = useMemo<ShortcutMap>(() => {
    const map: ShortcutMap = {
      space: () => player.togglePlay(),
      arrowleft: () => player.previous(),
      arrowright: () => player.next(),
      m: () => player.toggleMute(),
      '?': () => setShortcutsOpen((open) => !open),
      'mod+k': () => setSelectorOpen(!selectorOpen),
      escape: () => {
        setSettingsOpen(false);
        setShortcutsOpen(false);
        setCustomizeOpen(false);
        setSelectorOpen(false);
      },
    };

    themes.slice(0, 9).forEach((item, index) => {
      map[String(index + 1)] = () => enter(item.id);
    });

    return map;
  }, [themes, enter, player, selectorOpen, setSelectorOpen]);

  // Modals do their own Escape handling and focus trapping.
  useKeyboardShortcuts(shortcuts, !anyOverlayOpen);

  // Entering or switching a world must start at the top — otherwise a scroll
  // position left over from the mode picker hides the new hero behind the bar.
  useEffect(() => {
    if (!hasEntered) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [hasEntered, theme.id]);

  return (
    // `reducedMotion="always"` makes Motion skip transform animations while
    // still cross-fading, matching what the CSS layer does for keyframes.
    <MotionConfig reducedMotion={motionEnabled ? 'never' : 'always'}>
      {/* The whole app is one non-scrolling screen: the shell owns the viewport
          height and every child fits inside it rather than extending the page. */}
      <div className="relative flex h-dvh flex-col overflow-hidden">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas"
        >
          Skip to content
        </a>

        {/* Back to front: base gradient, the mode's scene, ambient layers. */}
        <ThemeBackground />
        <SceneBackground />
        <AmbientEffects />

        <TopBar
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onOpenCustomize={() => setCustomizeOpen(true)}
        />

        <main
          id="main"
          // Transparent still means clickable, so the screen wrappers would
          // otherwise swallow every click meant for the scene behind them.
          // Individual controls opt back in with `pointer-events-auto`.
          className="pointer-events-none relative z-10 min-h-0 flex-1"
          style={{
            // No need to clear the player bar while it is parked off-screen.
            paddingBottom: hasEntered ? 'var(--player-height)' : '0px',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={hasEntered ? 'world' : 'landing'}
              className="h-full"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
            >
              {hasEntered ? <World /> : <Landing />}
            </m.div>
          </AnimatePresence>
        </main>

        <MusicPlayer onOpenSettings={() => setSettingsOpen(true)} />

        <ToastViewport />
        <TransitionOverlay />
        <ModeSelectorOverlay />
        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onOpenCustomize={() => {
            setSettingsOpen(false);
            setCustomizeOpen(true);
          }}
        />
        {(customizeOpen || customizeLoaded) && (
          <Suspense fallback={null}>
            <CustomizePanel open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
          </Suspense>
        )}
        <ShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </MotionConfig>
  );
}
