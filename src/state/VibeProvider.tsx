import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_THEME_ID, THEMES, suggestedThemeId } from '@/themes';
import {
  EMPTY_CUSTOMIZATION,
  TEXT_LIMITS,
  UPLOADED,
  buildThemes,
  carryUpload,
  findIn,
  fitsUploadBudget,
  isAddedMode,
  isDeleted,
  isHidden,
  isRecord,
  newAddedId,
  sanitizeCustomization,
  sanitizeEdit,
  sanitizeUploads,
  type Customization,
  type ModeEdit,
  type Uploads,
} from '@/themes/customize';
import { cachedDefaults, fetchDefaults, withDefaults } from '@/themes/defaults';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { usePageHidden } from '@/hooks/usePageVisibility';
import { STORAGE_KEYS, clearStoredPreferences, readStorage } from '@/utils/storage';
import { readUrlState, syncUrlState } from '@/utils/url';
import { normaliseSource, sourceFields } from '@/music/resolve';
import type { VibePlaylist, VibeTheme } from '@/types/theme';
import {
  DEFAULT_PREFERENCES,
  VibeContext,
  type CustomPlaylist,
  type ImportResult,
  type SharedMode,
  type VibeBackup,
  type VibeContextValue,
  type VibePreferences,
} from './vibe-context';
import { sanitizeCustomPlaylists, sanitizeOverrides, sanitizePreferences } from './sanitize';
import { track } from '@/utils/analytics';
import { MAX_ADDED_MODES } from '@/themes/limits';

const BUILT_IN_IDS: ReadonlySet<string> = new Set(THEMES.map((theme) => theme.id));

const sanitize = (raw: unknown): Customization => sanitizeCustomization(raw, BUILT_IN_IDS);

/** Finds a mode by id or alias in the listener's list; always returns something. */
function pick(themes: readonly VibeTheme[], id: string | null | undefined): VibeTheme {
  return findIn(themes, id) ?? findIn(themes, DEFAULT_THEME_ID) ?? themes[0] ?? THEMES[0];
}

/** How long before the incoming world is swapped in behind the wipe. */
const SWAP_DELAY_MS = 380;
/** Total length of the transition overlay. */
const TRANSITION_MS = 900;

/**
 * Prefix that separates a listener's own playlists from the built-in ones.
 * The site's defaults are keyed by playlist id, so a custom id must never be
 * mistakable for one a `defaults` row could fill in.
 */
const CUSTOM_PREFIX = 'custom-';

const newCustomId = (): string =>
  `${CUSTOM_PREFIX}${
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10)
  }`;

/** A saved custom playlist, shaped like the ones themes declare. */
function toVibePlaylist(custom: CustomPlaylist): VibePlaylist {
  return {
    id: custom.id,
    name: custom.name,
    description: 'Your own playlist.',
    mood: 'Yours',
    ...sourceFields(custom.source),
  };
}

interface Bootstrap {
  themeId: string;
  /** True when the mode came from `?mode=` rather than storage or the default. */
  fromUrl: boolean;
  hasEntered: boolean;
  urlPlaylistId: string | null;
  /** The listener's mode list at load, so their own modes survive a reload. */
  themes: VibeTheme[];
}

function bootstrapState(): Bootstrap {
  const custom = sanitize(readStorage<unknown>(STORAGE_KEYS.customization, EMPTY_CUSTOMIZATION));
  const themes = buildThemes(THEMES, custom).filter((item) => !isDeleted(custom, item.id));
  const url = readUrlState();
  const fromUrl = findIn(themes, url.mode);
  const fromStorage = findIn(themes, readStorage<string | null>(STORAGE_KEYS.selectedTheme, null));
  const visible = themes.filter((item) => !isHidden(custom, item.id));
  const theme =
    fromUrl ??
    fromStorage ??
    findIn(visible, suggestedThemeId(new Date().getHours())) ??
    pick(themes, DEFAULT_THEME_ID);

  return {
    themeId: theme.id,
    fromUrl: Boolean(fromUrl),
    // A shared ?mode= link should drop you straight into that world.
    hasEntered: Boolean(fromUrl) || readStorage<boolean>(STORAGE_KEYS.hasEntered, false),
    urlPlaylistId: fromUrl ? url.playlist : null,
    themes,
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
    (stored) => (boot.fromUrl ? boot.themeId : (findIn(boot.themes, stored)?.id ?? boot.themeId)),
  );
  // The listener's own data syncs across open tabs (see `useLocalStorage`);
  // which mode each tab is showing does not.
  const [customization, setCustomization] = useLocalStorage<Customization>(
    STORAGE_KEYS.customization,
    EMPTY_CUSTOMIZATION,
    sanitize,
    true,
  );
  const [uploads, setUploads] = useLocalStorage<Uploads>(
    STORAGE_KEYS.uploads,
    {},
    sanitizeUploads,
    true,
  );
  const [hasEntered, setHasEntered] = useLocalStorage<boolean>(
    STORAGE_KEYS.hasEntered,
    boot.hasEntered,
    (stored) => boot.fromUrl || stored === true,
  );
  const [storedPreferences, setPreferences] = useLocalStorage<VibePreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
    sanitizePreferences,
    true,
  );
  // Only ever *cleared* now (a Customize relink replaces it): kept so links
  // people set in the old Settings field still play until they change them.
  const [playlistOverrides, setPlaylistOverrides] = useLocalStorage<Record<string, string>>(
    STORAGE_KEYS.playlistOverrides,
    {},
    sanitizeOverrides,
    true,
  );
  const [customPlaylistsByTheme, setCustomPlaylistsByTheme] = useLocalStorage<
    Record<string, CustomPlaylist[]>
  >(STORAGE_KEYS.customPlaylists, {}, sanitizeCustomPlaylists, true);
  const [selectedPlaylists, setSelectedPlaylists] = useLocalStorage<Record<string, string>>(
    STORAGE_KEYS.selectedPlaylists,
    {},
    // A ?playlist= in the link is an explicit instruction from whoever shared
    // it, so it has to beat whatever this browser picked last time. Without
    // this, a returning visitor silently gets their own old choice instead.
    (stored) =>
      boot.urlPlaylistId ? { ...stored, [boot.themeId]: boot.urlPlaylistId } : stored,
  );

  const [incomingTheme, setIncomingTheme] = useState<VibeTheme | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const systemReducedMotion = usePrefersReducedMotion();
  const tabHidden = usePageHidden();

  // The site's playlists and pictures (D1, via /api/config). Painted from this
  // browser's last copy at once, then refreshed — see `themes/defaults.ts`.
  const [siteDefaults, setSiteDefaults] = useState(cachedDefaults);
  useEffect(() => {
    let live = true;
    void fetchDefaults().then((fresh) => {
      // An unchanged answer keeps the old object, so nothing downstream rebuilds.
      if (!live || !fresh) return;
      setSiteDefaults((current) =>
        JSON.stringify(current) === JSON.stringify(fresh) ? current : fresh,
      );
    });
    return () => {
      live = false;
    };
  }, []);
  const builtIns = useMemo(() => withDefaults(THEMES, siteDefaults), [siteDefaults]);

  // Theme files plus the site's defaults are the starting point; the
  // listener's record is laid over them here, and everything downstream —
  // picker, number keys, ?mode=, colours — reads the result, so a customised
  // mode behaves exactly like a shipped one.
  const built = useMemo(
    () =>
      buildThemes(builtIns, customization, uploads).map((item) => {
        const own = customPlaylistsByTheme[item.id];
        // The listener's own playlists sit after the built-in ones, so adding
        // one never renumbers or displaces what the mode already offered.
        return own?.length
          ? { ...item, playlists: [...item.playlists, ...own.map(toVibePlaylist)] }
          : item;
      }),
    [builtIns, customization, uploads, customPlaylistsByTheme],
  );
  const allThemes = useMemo(
    () => built.filter((item) => !isDeleted(customization, item.id)),
    [built, customization],
  );
  const deletedThemes = useMemo(
    () => built.filter((item) => isDeleted(customization, item.id)),
    [built, customization],
  );
  const themes = useMemo(
    () => allThemes.filter((item) => !isHidden(customization, item.id)),
    [allThemes, customization],
  );

  const theme = useMemo(() => pick(allThemes, themeId), [allThemes, themeId]);

  // Merged with the defaults so a partial object saved by an older build (or a
  // preference added after that visit) still yields a complete set.
  const preferences = useMemo(
    () => ({ ...DEFAULT_PREFERENCES, ...storedPreferences }),
    [storedPreferences],
  );
  const motionEnabled = preferences.motion && !systemReducedMotion;

  const playlists = theme.playlists;

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
      const target = findIn(allThemes, nextId);
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
    [allThemes, themeId, motionEnabled, clearTimers, setThemeId],
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

  const isCustomPlaylist = useCallback(
    (playlistId: string) => playlistId.startsWith(CUSTOM_PREFIX),
    [],
  );

  const addCustomPlaylist = useCallback(
    (name: string, source: string, modeId: string = theme.id): string | null => {
      const normalised = normaliseSource(source);
      if (!normalised) return null;

      const id = newCustomId();
      const entry: CustomPlaylist = {
        id,
        name: name.trim().slice(0, 60) || 'My playlist',
        source: normalised,
      };

      setCustomPlaylistsByTheme((current) => ({
        ...current,
        [modeId]: [...(current[modeId] ?? []), entry],
      }));
      // Adding one is a request to hear it, so make it the active choice.
      setSelectedPlaylists((current) => ({ ...current, [modeId]: id }));
      track('playlist_added');
      return id;
    },
    [theme.id, setCustomPlaylistsByTheme, setSelectedPlaylists],
  );

  const removePlaylist = useCallback(
    (modeId: string, playlistId: string) => {
      if (isCustomPlaylist(playlistId)) {
        setCustomPlaylistsByTheme((current) => ({
          ...current,
          [modeId]: (current[modeId] ?? []).filter((item) => item.id !== playlistId),
        }));
      } else {
        // A built-in one is only taken off this mode — "Bring back" undoes it.
        setCustomization((current) => {
          const previous = current.edits[modeId] ?? {};
          const removed = [...new Set([...(previous.removedPlaylists ?? []), playlistId])];
          return {
            ...current,
            edits: { ...current.edits, [modeId]: { ...previous, removedPlaylists: removed } },
          };
        });
      }
      // Leaving the deleted id selected would resolve to the mode's first
      // playlist anyway, but the stale entry would linger in storage forever.
      setSelectedPlaylists((current) => {
        if (current[modeId] !== playlistId) return current;
        const next = { ...current };
        delete next[modeId];
        return next;
      });
    },
    [isCustomPlaylist, setCustomPlaylistsByTheme, setCustomization, setSelectedPlaylists],
  );

  const updatePlaylist = useCallback(
    (modeId: string, playlistId: string, patch: { name?: string; source?: string }): boolean => {
      // An empty link means "back to the default" for a built-in playlist, and
      // is refused for the listener's own (it would have nothing to play).
      const wantsSource = patch.source !== undefined;
      const source = wantsSource && patch.source?.trim() ? normaliseSource(patch.source) : null;
      if (wantsSource && patch.source?.trim() && !source) return false;
      if (wantsSource && isCustomPlaylist(playlistId) && !source) return false;

      // A link set in the old Settings field outranks every other source, so
      // left in place it would silently keep playing while this panel says
      // "playing your link". Relinking here is the newer intent, so drop it.
      if (wantsSource) {
        setPlaylistOverrides((current) => {
          if (!(playlistId in current)) return current;
          const next = { ...current };
          delete next[playlistId];
          return next;
        });
      }

      if (isCustomPlaylist(playlistId)) {
        setCustomPlaylistsByTheme((current) => ({
          ...current,
          [modeId]: (current[modeId] ?? []).map((item) =>
            item.id === playlistId
              ? {
                  ...item,
                  ...(patch.name !== undefined ? { name: patch.name.slice(0, 60) } : {}),
                  ...(source ? { source } : {}),
                }
              : item,
          ),
        }));
        return true;
      }

      setCustomization((current) => {
        const previous = current.edits[modeId] ?? {};
        const next: ModeEdit = { ...previous };
        if (patch.name !== undefined) {
          next.playlistNames = { ...previous.playlistNames, [playlistId]: patch.name.slice(0, 60) };
        }
        if (wantsSource) {
          const sources = { ...previous.playlistSources };
          if (source) sources[playlistId] = source;
          else delete sources[playlistId];
          next.playlistSources = sources;
        }
        return { ...current, edits: { ...current.edits, [modeId]: next } };
      });
      return true;
    },
    [isCustomPlaylist, setCustomPlaylistsByTheme, setCustomization, setPlaylistOverrides],
  );

  const setPreference = useCallback(
    <K extends keyof VibePreferences>(key: K, value: VibePreferences[K]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
      track('preference', `${String(key)}: ${String(value)}`);
    },
    [setPreferences],
  );

  /* ── Customising the modes themselves ──────────────────────────────────── */

  const dropUpload = useCallback(
    (id: string) =>
      setUploads((current) => {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      }),
    [setUploads],
  );

  const editMode = useCallback(
    (id: string, patch: ModeEdit) => {
      setCustomization((current) => {
        // Never hide or delete the last visible mode — the picker would be
        // empty and there would be no way back into a world.
        if (patch.hidden || patch.deleted) {
          const visible = buildThemes(THEMES, current).filter(
            (t) => !isHidden(current, t.id) && !isDeleted(current, t.id),
          );
          if (visible.length <= 1 && visible[0]?.id === id) return current;
        }
        const previous = current.edits[id] ?? {};
        const next: ModeEdit = { ...previous, ...patch };
        if (patch.colors) next.colors = { ...previous.colors, ...patch.colors };
        return { ...current, edits: { ...current.edits, [id]: next } };
      });
      // Choosing any other picture (or none) retires the uploaded one, so it
      // doesn't sit in storage eating the quota for nothing.
      if ('image' in patch && patch.image !== UPLOADED) dropUpload(id);
    },
    [setCustomization, dropUpload],
  );

  const setUpload = useCallback(
    (id: string, still: string): boolean => {
      // Browsers give a site ~5 MB, and a write over quota is dropped silently,
      // which would lose this picture *and* every edit after it.
      if (!fitsUploadBudget(uploads, id, still)) return false;
      setUploads((current) => ({ ...current, [id]: still }));
      editMode(id, { image: UPLOADED });
      return true;
    },
    [uploads, setUploads, editMode],
  );

  const resetMode = useCallback(
    (id: string) => {
      setCustomization((current) => {
        const edits = { ...current.edits };
        // An added mode keeps its name: reset means "undo my tweaks", and
        // falling back to the base's name would leave two modes called the same.
        const keep = isAddedMode(id) ? { name: edits[id]?.name } : undefined;
        delete edits[id];
        if (keep?.name) edits[id] = keep;
        return { ...current, edits };
      });
      dropUpload(id);
      track('mode_reset');
    },
    [setCustomization, dropUpload],
  );

  const addMode = useCallback(
    (sourceId: string, blank = false): string | null => {
      const source = findIn(allThemes, sourceId);
      if (!source || customization.added.length >= MAX_ADDED_MODES) return null;
      const id = newAddedId();

      // A copy carries over what the listener did to the source. A blank mode
      // borrows only its base's fonts and colours as a starting point and
      // empties the rest, so it really is a new place, not a renamed old one.
      const base = findIn(THEMES, source.baseId ?? source.id) ?? source;
      const draft: ModeEdit = blank
        ? {
            name: 'New mode',
            shortName: 'New',
            kicker: '',
            description: 'A place of my own.',
            icon: 'sparkle',
            image: null,
            quotes: [],
            stats: [],
            hud: [],
            ticker: [],
            effects: {},
            removedPlaylists: base.playlists.map((item) => item.id),
          }
        : {
            ...customization.edits[source.id],
            hidden: undefined,
            name: `${source.baseId ? '' : 'My '}${source.name}${source.baseId ? ' (copy)' : ''}`.slice(
              0,
              TEXT_LIMITS.name,
            ),
          };
      // The uploaded picture and the listener's own playlists are stored apart
      // from the edit, so a copy has to take them along or it loses them.
      const { edit, still } = carryUpload(draft, uploads[source.id], uploads, id);
      const own = blank ? [] : (customPlaylistsByTheme[source.id] ?? []);

      setCustomization((current) => {
        const order = buildThemes(THEMES, current).map((t) => t.id);
        order.splice(order.indexOf(source.id) + 1, 0, id);
        return {
          added: [...current.added, { id, baseId: source.baseId ?? source.id }],
          edits: { ...current.edits, [id]: edit },
          order,
        };
      });
      if (still) setUploads((current) => ({ ...current, [id]: still }));
      if (own.length) {
        setCustomPlaylistsByTheme((current) => ({
          ...current,
          [id]: own.map((item) => ({ ...item, id: newCustomId() })),
        }));
      }
      track('mode_added', blank ? 'blank' : 'copy');
      return id;
    },
    [
      allThemes,
      customization.edits,
      uploads,
      customPlaylistsByTheme,
      setCustomization,
      setUploads,
      setCustomPlaylistsByTheme,
    ],
  );

  const removeMode = useCallback(
    (id: string) => {
      const visible = themes.filter((item) => item.id !== id);
      if (!visible.length) return;

      if (isAddedMode(id)) {
        setCustomization((current) => {
          const edits = { ...current.edits };
          delete edits[id];
          return {
            added: current.added.filter((item) => item.id !== id),
            edits,
            order: current.order.filter((item) => item !== id),
          };
        });
        // Its playlists and saved choice would otherwise sit in storage forever.
        setCustomPlaylistsByTheme((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        setSelectedPlaylists((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        dropUpload(id);
      } else {
        // Built-in modes go to the bin rather than vanishing — the theme file
        // is still there, so "Restore" costs nothing and saves a bad click.
        editMode(id, { deleted: true });
      }
      track('mode_deleted', isAddedMode(id) ? 'own' : 'built-in');
      if (id === themeId) setThemeId(visible[0].id);
    },
    [
      themes,
      themeId,
      editMode,
      dropUpload,
      setCustomization,
      setCustomPlaylistsByTheme,
      setSelectedPlaylists,
      setThemeId,
    ],
  );

  const moveMode = useCallback(
    (id: string, delta: -1 | 1) => {
      setCustomization((current) => {
        // Deleted modes are invisible in the list, so they are kept out of the
        // swap — otherwise "Move up" past one would look like it did nothing.
        const all = buildThemes(THEMES, current).map((t) => t.id);
        const binned = all.filter((item) => isDeleted(current, item));
        const order = all.filter((item) => !isDeleted(current, item));
        const from = order.indexOf(id);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= order.length) return current;
        [order[from], order[to]] = [order[to], order[from]];
        return { ...current, order: [...order, ...binned] };
      });
    },
    [setCustomization],
  );

  const exportSettings = useCallback(
    (): VibeBackup => ({
      app: 'vibe-mode',
      version: 1,
      customization,
      preferences: storedPreferences,
      customPlaylists: customPlaylistsByTheme,
      playlistOverrides,
      uploads,
    }),
    [customization, storedPreferences, customPlaylistsByTheme, playlistOverrides, uploads],
  );

  const exportMode = useCallback(
    (id: string): SharedMode | null => {
      const mode = findIn(allThemes, id);
      if (!mode) return null;
      const edit: ModeEdit = { ...customization.edits[id], hidden: undefined, deleted: undefined };
      // Sharing a built-in mode shares it under its own name, so the friend
      // gets "Metro Mode", not a copy called nothing.
      edit.name ||= mode.name;
      return {
        app: 'vibe-mode',
        version: 1,
        kind: 'mode',
        baseId: mode.baseId ?? mode.id,
        edit,
        playlists: customPlaylistsByTheme[id] ?? [],
        ...(edit.image === UPLOADED && uploads[id] ? { upload: uploads[id] } : {}),
      };
    },
    [allThemes, customization.edits, customPlaylistsByTheme, uploads],
  );

  const importSettings = useCallback(
    (raw: unknown): ImportResult => {
      if (!isRecord(raw) || raw.app !== 'vibe-mode') return null;

      // One shared mode is *added* under a fresh id: someone sending you their
      // mode must never be able to overwrite yours.
      if (raw.kind === 'mode') {
        const baseId =
          typeof raw.baseId === 'string' && BUILT_IN_IDS.has(raw.baseId) ? raw.baseId : null;
        const sanitized = sanitizeEdit(raw.edit);
        if (!baseId || !sanitized || customization.added.length >= MAX_ADDED_MODES) return null;
        const id = newAddedId();
        const offered = sanitizeUploads({ [id]: raw.upload })[id];
        // Same storage budget as an upload made here, or the picture would show
        // now and be gone after a reload.
        const { edit, still: upload } = carryUpload(sanitized, offered, uploads, id);
        edit.hidden = undefined;
        edit.deleted = undefined;

        const playlists = sanitizeCustomPlaylists({ [id]: raw.playlists })[id] ?? [];
        setCustomization((current) => ({
          added: [...current.added, { id, baseId }],
          edits: { ...current.edits, [id]: edit },
          order: [...buildThemes(THEMES, current).map((t) => t.id), id],
        }));
        if (upload) setUploads((current) => ({ ...current, [id]: upload }));
        // Fresh ids, so a playlist link set on the sender's side can't clash
        // with one already saved here.
        if (playlists.length) {
          setCustomPlaylistsByTheme((current) => ({
            ...current,
            [id]: playlists.map((item) => ({ ...item, id: newCustomId() })),
          }));
        }
        return { kind: 'mode', id, pictureDropped: Boolean(offered) && !upload };
      }

      setCustomization(sanitize(raw.customization));
      setUploads(sanitizeUploads(raw.uploads));
      setPreferences(sanitizePreferences(raw.preferences));
      setCustomPlaylistsByTheme(sanitizeCustomPlaylists(raw.customPlaylists));
      setPlaylistOverrides(sanitizeOverrides(raw.playlistOverrides));
      return { kind: 'backup' };
    },
    [
      uploads,
      setCustomization,
      setUploads,
      setPreferences,
      setCustomPlaylistsByTheme,
      setPlaylistOverrides,
    ],
  );

  const resetEverything = useCallback(() => {
    clearStoredPreferences();
    setPreferences(DEFAULT_PREFERENCES);
    setPlaylistOverrides({});
    setCustomPlaylistsByTheme({});
    setSelectedPlaylists({});
    setCustomization(EMPTY_CUSTOMIZATION);
    setUploads({});
    setThemeId(DEFAULT_THEME_ID);
    setHasEntered(false);
    setSelectorOpen(false);
    track('reset_everything');
  }, [
    setPreferences,
    setPlaylistOverrides,
    setCustomPlaylistsByTheme,
    setSelectedPlaylists,
    setCustomization,
    setUploads,
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
      themes,
      allThemes,
      deletedThemes,
      theme,
      themeId: theme.id,
      playlists,
      playlist,
      playlistId: playlist?.id ?? null,
      selectPlaylist,
      addCustomPlaylist,
      removePlaylist,
      updatePlaylist,
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
      customization,
      editMode,
      resetMode,
      addMode,
      removeMode,
      moveMode,
      exportSettings,
      importSettings,
      exportMode,
      setUpload,
      resetEverything,
    }),
    [
      themes,
      allThemes,
      deletedThemes,
      theme,
      playlists,
      playlist,
      selectPlaylist,
      addCustomPlaylist,
      removePlaylist,
      updatePlaylist,
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
      customization,
      editMode,
      resetMode,
      addMode,
      removeMode,
      moveMode,
      exportSettings,
      importSettings,
      exportMode,
      setUpload,
      resetEverything,
    ],
  );

  return <VibeContext.Provider value={value}>{children}</VibeContext.Provider>;
}
