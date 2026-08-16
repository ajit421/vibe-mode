import { useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useVibe } from '@/state/vibe-context';
import { usePlayer } from '@/state/player-context';
import { useKeyboardShortcuts, type ShortcutMap } from '@/hooks/useKeyboardShortcuts';
import { emitVibeEvent } from '@/utils/events';
import { ThemeBackground } from '@/components/theme/ThemeBackground';
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

/** Extra keys that only exist inside a particular world. */
const MODE_KEYS: Record<string, ShortcutMap> = {
  metro: { a: () => emitVibeEvent('announce') },
  'cab-wala': { r: () => emitVibeEvent('reroute') },
  'radio-wala': { t: () => emitVibeEvent('tune') },
};

export function AppShell() {
  const { themes, theme, hasEntered, enter, selectorOpen, setSelectorOpen, motionEnabled } =
    useVibe();
  const player = usePlayer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const anyOverlayOpen = settingsOpen || shortcutsOpen || selectorOpen;

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
        setSelectorOpen(false);
      },
    };

    themes.slice(0, 9).forEach((item, index) => {
      map[String(index + 1)] = () => enter(item.id);
    });

    // Mode-specific keys are only bound while that mode is active, so we never
    // swallow a keystroke a different world has no use for.
    Object.assign(map, MODE_KEYS[theme.id] ?? {});

    return map;
  }, [themes, theme.id, enter, player, selectorOpen, setSelectorOpen]);

  // Modals do their own Escape handling and focus trapping.
  useKeyboardShortcuts(shortcuts, !anyOverlayOpen);

  return (
    // `reducedMotion="always"` makes Motion skip transform animations while
    // still cross-fading, matching what the CSS layer does for keyframes.
    <MotionConfig reducedMotion={motionEnabled ? 'never' : 'always'}>
      <div className="relative min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas"
        >
          Skip to content
        </a>

        <ThemeBackground />
        <AmbientEffects />

        <TopBar
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />

        <main
          id="main"
          className="relative z-10"
          style={{
            // No need to clear the player bar while it is parked off-screen.
            paddingBottom: hasEntered ? 'calc(var(--player-height) + 2.5rem)' : '2rem',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={hasEntered ? 'world' : 'landing'}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
            >
              {hasEntered ? <World /> : <Landing />}
            </motion.div>
          </AnimatePresence>
        </main>

        <MusicPlayer onOpenSettings={() => setSettingsOpen(true)} />

        <ToastViewport />
        <TransitionOverlay />
        <ModeSelectorOverlay />
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <ShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </MotionConfig>
  );
}
