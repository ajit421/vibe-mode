import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_THEME_ID, THEMES, findTheme, getTheme } from '@/themes';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { usePageHidden } from '@/hooks/usePageVisibility';
import { STORAGE_KEYS, clearStoredPreferences, readStorage } from '@/utils/storage';
import { readUrlState, syncUrlState } from '@/utils/url';
import { extractPlaylistId, extractVideoId } from '@/music/resolve';
import type { VibePlaylist } from '@/types/theme';
import {
  DEFAULT_PREFERENCES,
  VibeContext,
  type CustomPlaylist,
  type VibeContextValue,
  type VibePreferences,
} from './vibe-context';

/** How long before the incoming world is swapped in behind the wipe. */
const SWAP_DELAY_MS = 380;
/** Total length of the transition overlay. */
const TRANSITION_MS = 900;

/**
 * Prefix that separates a listener's own playlists from the built-in ones.
 * `playlistsFor` derives env variable names from playlist ids, so a custom id
 * must never be mistakable for one a `VITE_PLAYLIST_*` variable could fill in.
 */
const CUSTOM_PREFIX = 'custom-';

const newCustomId = (): string =>
  `${CUSTOM_PREFIX}${
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10)
  }`;

/**
 * Turns what someone pasted into something the player can load: a playlist
 * link or id, or a comma-separated set of video links or ids. Returns null
 * when none of it parses, so the caller can say so rather than saving a
 * playlist that will never play.
 */
function normaliseSource(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const playlistId = extractPlaylistId(trimmed);
  if (playlistId) return playlistId;

  const videoIds = trimmed
    .split(',')
    .map((entry) => extractVideoId(entry))
    .filter((entry): entry is string => entry !== null);

  return videoIds.length ? videoIds.join(',') : null;
}

/** A saved custom playlist, shaped like the ones themes declare. */
function toVibePlaylist(custom: CustomPlaylist): VibePlaylist {
  const base = { id: custom.id, name: custom.name, description: 'Your own playlist.', mood: 'Yours' };
  return custom.source.includes(',')
    ? { ...base, videoIds: custom.source.split(',') }
    : { ...base, youtubePlaylistId: custom.source };
}

interface Bootstrap {
  themeId: string;
  /** True when the mode came from `?mode=` rather than storage or the default. */
  fromUrl: boolean;
  hasEntered: boolean;
  urlPlaylistId: string | null;
}

function bootstrapState(): Bootstrap {
  const url = readUrlState();
  const fromUrl = findTheme(url.mode);
  const fromStorage = findTheme(readStorage<string | null>(STORAGE_KEYS.selectedTheme, null));
  const theme = fromUrl ?? fromStorage ?? getTheme(DEFAULT_THEME_ID);

  return {
    themeId: theme.id,
    fromUrl: Boolean(fromUrl),
    // A shared ?mode= link should drop you straight into that world.
    hasEntered: Boolean(fromUrl) || readStorage<boolean>(STORAGE_KEYS.hasEntered, false),
    urlPlaylistId: fromUrl ? url.playlist : null,
  };
}

export function VibeProvider({ children }: { children: ReactNode }) {
  const bootRef = useRef<Bootstrap | null>(null);
  bootRef.current ??= bootstrapState();
  const boot = bootRef.current;

  // `useLocalStorage` prefers whatever is already in storage, so anything the
  // URL decided has to be re-asserted here — otherwise a returning visitor's
  // saved mode silently overrides the ?mode= link they were sent.
  const [themeId, setThemeId] = useLocalStorage<string>(
    STORAGE_KEYS.selectedTheme,
    boot.themeId,
    (stored) => (boot.fromUrl ? boot.themeId : (findTheme(stored)?.id ?? boot.themeId)),
  );
  const [hasEntered, setHasEntered] = useLocalStorage<boolean>(
    STORAGE_KEYS.hasEntered,
    boot.hasEntered,
    (stored) => boot.fromUrl || stored === true,
  );
  const [storedPreferences, setPreferences] = useLocalStorage<VibePreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );
  const [playlistOverrides, setPlaylistOverrides] = useLocalStorage<Record<string, string>>(
    STORAGE_KEYS.playlistOverrides,
    {},
  );
  const [customPlaylistsByTheme, setCustomPlaylistsByTheme] = useLocalStorage<
    Record<string, CustomPlaylist[]>
  >(STORAGE_KEYS.customPlaylists, {});
  const [selectedPlaylists, setSelectedPlaylists] = useLocalStorage<Record<string, string>>(
    STORAGE_KEYS.selectedPlaylists,
    {},
    // A ?playlist= in the link is an explicit instruction from whoever shared
    // it, so it has to beat whatever this browser picked last time. Without
    // this, a returning visitor silently gets their own old choice instead.
    (stored) =>
      boot.urlPlaylistId ? { ...stored, [boot.themeId]: boot.urlPlaylistId } : stored,
  );

  const [incomingTheme, setIncomingTheme] = useState<ReturnType<typeof getTheme> | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const systemReducedMotion = usePrefersReducedMotion();
  const tabHidden = usePageHidden();

  const theme = useMemo(() => getTheme(themeId), [themeId]);

  // Merged with the defaults so a partial object saved by an older build (or a
  // preference added after that visit) still yields a complete set.
  const preferences = useMemo(
    () => ({ ...DEFAULT_PREFERENCES, ...storedPreferences }),
    [storedPreferences],
  );
  const motionEnabled = preferences.motion && !systemReducedMotion;

  const customPlaylists = useMemo(
    () => customPlaylistsByTheme[theme.id] ?? [],
    [customPlaylistsByTheme, theme.id],
  );

  // The listener's own playlists sit after the built-in ones, so adding one
  // never renumbers or displaces what the mode already offered.
  const playlists = useMemo(
    () => [...theme.playlists, ...customPlaylists.map(toVibePlaylist)],
    [theme.playlists, customPlaylists],
  );

  const playlist = useMemo(() => {
    const preferred = selectedPlaylists[theme.id];
    return playlists.find((item) => item.id === preferred) ?? playlists[0];
  }, [playlists, selectedPlaylists, theme.id]);

  /* ── Theme switching, with a cinematic wipe in between ─────────────────── */
  const timers = useRef<number[]>([]);
  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const selectTheme = useCallback(
    (nextId: string) => {
      const target = findTheme(nextId);
      if (!target) return;

      setSelectorOpen(false);
      if (target.id === themeId) return;

      clearTimers();

      if (!motionEnabled) {
        setThemeId(target.id);
        return;
      }

      setIncomingTheme(target);
      timers.current.push(
        window.setTimeout(() => setThemeId(target.id), SWAP_DELAY_MS),
        window.setTimeout(() => setIncomingTheme(null), TRANSITION_MS),
      );
    },
    [themeId, motionEnabled, clearTimers, setThemeId],
  );

  useEffect(() => clearTimers, [clearTimers]);

  const enter = useCallback(
    (nextId: string) => {
      selectTheme(nextId);
      setHasEntered(true);
    },
    [selectTheme, setHasEntered],
  );

  const leaveToLanding = useCallback(() => {
    setSelectorOpen(false);
    setHasEntered(false);
  }, [setHasEntered]);

  const selectPlaylist = useCallback(
    (playlistId: string) => {
      setSelectedPlaylists((current) => ({ ...current, [theme.id]: playlistId }));
    },
    [theme.id, setSelectedPlaylists],
  );

  const addCustomPlaylist = useCallback(
    (name: string, source: string): string | null => {
      const normalised = normaliseSource(source);
      if (!normalised) return null;

      const id = newCustomId();
      const entry: CustomPlaylist = {
        id,
        name: name.trim() || 'My playlist',
        source: normalised,
      };

      setCustomPlaylistsByTheme((current) => ({
        ...current,
        [theme.id]: [...(current[theme.id] ?? []), entry],
      }));
      // Adding one is a request to hear it, so make it the active choice.
      setSelectedPlaylists((current) => ({ ...current, [theme.id]: id }));
      return id;
    },
    [theme.id, setCustomPlaylistsByTheme, setSelectedPlaylists],
  );

  const removeCustomPlaylist = useCallback(
    (playlistId: string) => {
      setCustomPlaylistsByTheme((current) => ({
        ...current,
        [theme.id]: (current[theme.id] ?? []).filter((item) => item.id !== playlistId),
      }));
      // Leaving the deleted id selected would resolve to the mode's first
      // playlist anyway, but the stale entry would linger in storage forever.
      setSelectedPlaylists((current) => {
        if (current[theme.id] !== playlistId) return current;
        const next = { ...current };
        delete next[theme.id];
        return next;
      });
    },
    [theme.id, setCustomPlaylistsByTheme, setSelectedPlaylists],
  );

  const isCustomPlaylist = useCallback(
    (playlistId: string) => playlistId.startsWith(CUSTOM_PREFIX),
    [],
  );

  const setPreference = useCallback(
    <K extends keyof VibePreferences>(key: K, value: VibePreferences[K]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    [setPreferences],
  );

  const setPlaylistOverride = useCallback(
    (playlistId: string, value: string) => {
      setPlaylistOverrides((current) => {
        const next = { ...current };
        if (value.trim()) next[playlistId] = value.trim();
        else delete next[playlistId];
        return next;
      });
    },
    [setPlaylistOverrides],
  );

  const resetEverything = useCallback(() => {
    clearStoredPreferences();
    setPreferences(DEFAULT_PREFERENCES);
    setPlaylistOverrides({});
    setCustomPlaylistsByTheme({});
    setSelectedPlaylists({});
    setThemeId(DEFAULT_THEME_ID);
    setHasEntered(false);
    setSelectorOpen(false);
  }, [
    setPreferences,
    setPlaylistOverrides,
    setCustomPlaylistsByTheme,
    setSelectedPlaylists,
    setThemeId,
    setHasEntered,
  ]);

  /* ── Paint the theme onto <html> so CSS variables drive the whole UI ───── */
  useEffect(() => {
    const root = document.documentElement;
    const { colors, typography, background } = theme;

    root.style.setProperty('--c-primary', colors.primary);
    root.style.setProperty('--c-secondary', colors.secondary);
    root.style.setProperty('--c-accent', colors.accent);
    root.style.setProperty('--c-background', colors.background);
    root.style.setProperty('--c-background-alt', colors.backgroundAlt);
    root.style.setProperty('--c-surface', colors.surface);
    root.style.setProperty('--c-text', colors.text);
    root.style.setProperty('--c-muted', colors.muted);
    root.style.setProperty('--c-border', colors.border);
    root.style.setProperty('--c-glow', colors.glow);

    if (typography?.heading) root.style.setProperty('--f-heading', typography.heading);
    if (typography?.body) root.style.setProperty('--f-body', typography.body);
    if (typography?.mono) root.style.setProperty('--f-mono', typography.mono);
    root.style.setProperty('--f-heading-tracking', typography?.headingTracking ?? '-0.01em');

    root.style.setProperty('--vibe-bg', background.gradient ?? colors.background);
    root.style.setProperty('--vibe-bg-overlay', background.overlay ?? 'none');

    root.dataset.theme = theme.id;

    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    meta?.setAttribute('content', colors.background);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.motion = motionEnabled ? 'on' : 'off';
  }, [motionEnabled]);

  useEffect(() => {
    document.documentElement.dataset.tabHidden = tabHidden ? 'true' : 'false';
  }, [tabHidden]);

  /* ── Document title + description follow the active world ─────────────── */
  useEffect(() => {
    if (!hasEntered) {
      document.title = 'Vibe Mode — Where are you right now?';
      return;
    }
    document.title = theme.seo?.title ?? `${theme.name} — Vibe Mode`;
  }, [theme, hasEntered]);

  useEffect(() => {
    const description = hasEntered
      ? (theme.seo?.description ?? theme.description)
      : 'Pick where you are and the whole website becomes that world, with the music to match.';
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', description);
  }, [theme, hasEntered]);

  /* ── Keep ?mode= / ?playlist= shareable, without polluting history ────── */
  useEffect(() => {
    if (!hasEntered) {
      syncUrlState({ mode: null, playlist: null });
      return;
    }
    syncUrlState({ mode: theme.id, playlist: playlist?.id ?? null });
  }, [hasEntered, theme.id, playlist?.id]);

  const value = useMemo<VibeContextValue>(
    () => ({
      themes: THEMES,
      theme,
      themeId: theme.id,
      playlists,
      playlist,
      playlistId: playlist?.id ?? null,
      selectPlaylist,
      customPlaylists,
      addCustomPlaylist,
      removeCustomPlaylist,
      isCustomPlaylist,
      selectTheme,
      incomingTheme,
      isTransitioning: incomingTheme !== null,
      hasEntered,
      enter,
      leaveToLanding,
      selectorOpen,
      setSelectorOpen,
      preferences,
      setPreference,
      motionEnabled,
      systemReducedMotion,
      playlistOverrides,
      setPlaylistOverride,
      resetEverything,
    }),
    [
      theme,
      playlists,
      playlist,
      selectPlaylist,
      customPlaylists,
      addCustomPlaylist,
      removeCustomPlaylist,
      isCustomPlaylist,
      selectTheme,
      incomingTheme,
      hasEntered,
      enter,
      leaveToLanding,
      selectorOpen,
      preferences,
      setPreference,
      motionEnabled,
      systemReducedMotion,
      playlistOverrides,
      setPlaylistOverride,
      resetEverything,
    ],
  );

  return <VibeContext.Provider value={value}>{children}</VibeContext.Provider>;
}
