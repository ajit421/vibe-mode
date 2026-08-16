import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
    <div className="relative min-h-dvh">
      <ThemeBackground />
      <AmbientEffects />

      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <main
        id="main"
        className="relative z-10"
        style={{ paddingBottom: 'calc(var(--player-height) + 2.5rem)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={hasEntered ? 'world' : 'landing'}
            initial={motionEnabled ? { opacity: 0, y: 12 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={motionEnabled ? { opacity: 0, y: -10 } : { opacity: 0 }}
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
  );
}
