import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { usePageHidden } from '@/hooks/usePageVisibility';
import { resolvePlaylistSource, sourceKey, type PlaylistSource } from '@/music/resolve';
import {
  YT_STATE,
  describeYouTubeError,
  loadYouTubeIframeApi,
  type YTNamespace,
  type YTPlayer,
  type YTPlayerEvent,
} from '@/music/youtube';
import { STORAGE_KEYS } from '@/utils/storage';
import { clamp, tidyTrackTitle } from '@/utils/format';
import { useVibe } from './vibe-context';
import { PlayerContext, type PlayerContextValue, type PlayerStatus, type PlayerTrack } from './player-context';

const PROGRESS_INTERVAL_MS = 400;
/** Give up skipping past broken tracks after this many in a row. */
const MAX_CONSECUTIVE_ERRORS = 3;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { playlist, playlistOverrides } = useVibe();
  const tabHidden = usePageHidden();

  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  const [status, setStatus] = useState<PlayerStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [trackCount, setTrackCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const [volume, setStoredVolume] = useLocalStorage<number>(STORAGE_KEYS.volume, 70);
  const [isMuted, setIsMuted] = useLocalStorage<boolean>(STORAGE_KEYS.muted, false);

  const errorStreak = useRef(0);
  const [retryToken, setRetryToken] = useState(0);

  const source = useMemo<PlaylistSource | null>(
    () => resolvePlaylistSource(playlist, playlist ? playlistOverrides[playlist.id] : undefined),
    [playlist, playlistOverrides],
  );
  const key = sourceKey(source);

  // `source` is a fresh object whenever the playlist or the overrides map
  // changes identity, even when it describes the exact same thing to load.
  // The player effect keys off `key` (the value, not the object) and reads the
  // source through this ref, so a no-op change no longer tears the iframe down
  // and restarts the track from zero.
  const sourceRef = useRef(source);
  sourceRef.current = source;

  // Refs let the YouTube callbacks read fresh values without being rebuilt.
  const wasPlayingRef = useRef(false);
  wasPlayingRef.current = isPlaying;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const mutedRef = useRef(isMuted);
  mutedRef.current = isMuted;
  const hasStartedRef = useRef(hasStarted);
  hasStartedRef.current = hasStarted;

  const readTrack = useCallback((player: YTPlayer) => {
    const data = player.getVideoData?.();
    if (data?.video_id) {
      setTrack({
        videoId: data.video_id,
        title: tidyTrackTitle(data.title || 'Loading track…'),
        author: data.author || '',
        url: `https://www.youtube.com/watch?v=${data.video_id}`,
      });
    }
    const list = player.getPlaylist?.();
    setTrackCount(list?.length ?? 0);
    const index = player.getPlaylistIndex?.();
    if (typeof index === 'number' && index >= 0) setTrackIndex(index);
  }, []);

  const refreshTimers = useRef<number[]>([]);
  const clearRefreshTimers = useCallback(() => {
    for (const id of refreshTimers.current) window.clearTimeout(id);
    refreshTimers.current = [];
  }, []);

  /**
   * A newly cued playlist does not expose its track list straight away, and
   * the CUED event can arrive before the metadata does — read once and the bar
   * ends up showing the *previous* playlist's tracks under the new playlist's
   * name. Re-reading on a short schedule lets it catch up.
   */
  const settleTrackInfo = useCallback(
    (player: YTPlayer) => {
      clearRefreshTimers();
      for (const delay of [250, 700, 1500, 2600, 4200]) {
        refreshTimers.current.push(window.setTimeout(() => readTrack(player), delay));
      }
    },
    [clearRefreshTimers, readTrack],
  );

  useEffect(() => clearRefreshTimers, [clearRefreshTimers]);

  /**
   * Some tracks are licensed so they cannot be played outside YouTube. The
   * player reports nothing for those — no error event, it simply refuses to
   * start — so pressing play appears to do nothing at all. Watch for that and
   * move on rather than leaving the user with a dead button.
   */
  const watchdog = useRef<number | null>(null);
  const blockedSkips = useRef(0);

  const clearWatchdog = useCallback(() => {
    if (watchdog.current) window.clearTimeout(watchdog.current);
    watchdog.current = null;
  }, []);

  const armWatchdog = useCallback(() => {
    clearWatchdog();

    // A restricted track reports BUFFERING and stays there indefinitely, so
    // buffering alone cannot mean "still loading" — it only buys extra time,
    // and only up to this deadline. Generous enough not to punish a slow
    // connection, short enough that a dead track doesn't strand the listener.
    const deadline = Date.now() + 9000;

    const tick = () => {
      const player = playerRef.current;
      if (!player) return;

      const state = player.getPlayerState?.();
      if (state === YT_STATE.PLAYING) return;

      if (state === YT_STATE.BUFFERING && Date.now() < deadline) {
        watchdog.current = window.setTimeout(tick, 1200);
        return;
      }

      if (blockedSkips.current >= MAX_CONSECUTIVE_ERRORS) {
        setStatus('error');
        setErrorMessage('These tracks can’t be played outside YouTube. Try another playlist.');
        return;
      }

      blockedSkips.current += 1;
      setErrorMessage('That track can’t play here — skipping…');
      player.nextVideo();
      armWatchdog();
    };

    watchdog.current = window.setTimeout(tick, 2500);
  }, [clearWatchdog]);

  useEffect(() => clearWatchdog, [clearWatchdog]);

  /* ── Create / re-target the YouTube player ────────────────────────────── */
  useEffect(() => {
    if (!host) return;

    const source = sourceRef.current;
    if (!source) {
      setStatus('unconfigured');
      setIsPlaying(false);
      setTrack(null);
      setTrackCount(0);
      setProgress(0);
      setDuration(0);
      playerRef.current?.pauseVideo?.();
      return;
    }

    let cancelled = false;
    errorStreak.current = 0;
    setStatus('loading');
    setErrorMessage(null);
    setProgress(0);
    setDuration(0);
    // Drop the outgoing playlist's track straight away rather than showing it
    // under the incoming playlist's name while the swap is in flight.
    setTrack(null);
    setTrackCount(0);
    setTrackIndex(0);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled) return;

        // Only resume automatically if music was already playing — that counts
        // as an existing user gesture, so no autoplay-policy problem.
        const resumePlayback = wasPlayingRef.current;

        // A player created with a playlist in `playerVars` does not reliably
        // re-target: `cuePlaylist`/`loadPlaylist` are accepted but leave it on
        // the original list, so the bar ends up one switch behind. Rebuilding
        // the player is the only dependable way to change playlists.
        if (playerRef.current) {
          playerRef.current.destroy?.();
          playerRef.current = null;
        }
        host.replaceChildren();

        // YouTube *replaces* the element it is given, so hand it a throwaway
        // child rather than the div React is holding a ref to.
        const mount = document.createElement('div');
        host.appendChild(mount);

        // `videoId` must be absent entirely for a playlist — passing the key
        // with an undefined value makes the API throw "Invalid video id".
        const config: ConstructorParameters<YTNamespace['Player']>[1] = {
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: resumePlayback ? 1 : 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            fs: 0,
            playsinline: 1,
            iv_load_policy: 3,
            origin: window.location.origin,
            ...(source.kind === 'playlist'
              ? { listType: 'playlist', list: source.playlistId }
              : { playlist: source.videoIds.slice(1).join(',') }),
          },
          events: {
            onReady: (event: YTPlayerEvent) => {
              const player = event.target;

              // The embed is covered by the artwork, so it must not be a tab
              // stop or a thing a screen reader offers to enter — nothing in
              // there is reachable or useful once it is hidden behind the
              // thumbnail. We drive it entirely through the JS API.
              const iframe = host.querySelector('iframe');
              if (iframe) {
                iframe.setAttribute('tabindex', '-1');
                iframe.setAttribute('aria-hidden', 'true');
                iframe.setAttribute('title', 'Audio stream');
              }

              player.setVolume(clamp(volumeRef.current, 0, 100));
              if (mutedRef.current) player.mute();
              else player.unMute();
              setStatus('ready');
              setDuration(player.getDuration?.() ?? 0);
              readTrack(player);
              settleTrackInfo(player);
            },

            onStateChange: (event: YTPlayerEvent) => {
              const player = event.target;
              const state = event.data;

              setIsBuffering(state === YT_STATE.BUFFERING);

              if (state === YT_STATE.PLAYING) {
                errorStreak.current = 0;
                blockedSkips.current = 0;
                clearWatchdog();
                setIsPlaying(true);
                setHasStarted(true);
                setStatus('ready');
                setErrorMessage(null);
                setDuration(player.getDuration?.() ?? 0);
              } else if (state === YT_STATE.PAUSED || state === YT_STATE.CUED) {
                setIsPlaying(false);
              } else if (state === YT_STATE.ENDED) {
                // A single-track playlist with repeat off simply stops.
                setIsPlaying(false);
              }

              if (state !== YT_STATE.UNSTARTED) readTrack(player);
            },

            onError: (event: YTPlayerEvent) => {
              const message = describeYouTubeError(event.data);
              errorStreak.current += 1;

              const player = event.target;
              const remaining = player.getPlaylist?.()?.length ?? 0;

              // One dud track shouldn't kill the session — hop over it.
              if (errorStreak.current <= MAX_CONSECUTIVE_ERRORS && remaining > 1) {
                setErrorMessage(`${message} Skipping…`);
                window.setTimeout(() => player.nextVideo(), 600);
                return;
              }

              setStatus('error');
              setIsPlaying(false);
              setErrorMessage(message);
            },
          },
        };

        if (source.kind === 'videos') config.videoId = source.videoIds[0];

        playerRef.current = new YT.Player(mount, config);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : 'YouTube is taking a chai break. Try again.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [host, key, readTrack, settleTrackInfo, clearWatchdog, retryToken]);

  /* ── Tear the player down exactly once, on unmount ────────────────────── */
  useEffect(
    () => () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
    },
    [],
  );

  /* ── Progress ticker ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isPlaying || tabHidden) return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setProgress(player.getCurrentTime?.() ?? 0);
      const total = player.getDuration?.() ?? 0;
      if (total) setDuration(total);
      // Titles sometimes arrive a beat after the state change.
      if (!track?.title || track.title === 'Loading track…') readTrack(player);
    }, PROGRESS_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isPlaying, tabHidden, track?.title, readTrack]);

  /* ── Push volume / mute changes into the player ───────────────────────── */
  useEffect(() => {
    const player = playerRef.current;
    if (!player || status !== 'ready') return;
    player.setVolume?.(clamp(volume, 0, 100));
  }, [volume, status]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || status !== 'ready') return;
    if (isMuted) player.mute?.();
    else player.unMute?.();
  }, [isMuted, status]);

  /* ── Controls ─────────────────────────────────────────────────────────── */
  const play = useCallback(() => {
    playerRef.current?.playVideo?.();
    armWatchdog();
  }, [armWatchdog]);

  const pause = useCallback(() => {
    clearWatchdog();
    playerRef.current?.pauseVideo?.();
  }, [clearWatchdog]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (wasPlayingRef.current) {
      clearWatchdog();
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
      armWatchdog();
    }
  }, [armWatchdog, clearWatchdog]);

  const next = useCallback(() => {
    playerRef.current?.nextVideo?.();
  }, []);

  const previous = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    // Match the convention people expect: restart the track first, and only
    // jump back once you're near the beginning.
    if ((player.getCurrentTime?.() ?? 0) > 3) player.seekTo(0, true);
    else player.previousVideo();
  }, []);

  const seek = useCallback((seconds: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(Math.max(0, seconds), true);
    setProgress(Math.max(0, seconds));
  }, []);

  const setVolume = useCallback(
    (next: number) => {
      const value = clamp(Math.round(next), 0, 100);
      setStoredVolume(value);
      // Nudging the slider up should undo a mute — that's what people mean.
      if (value > 0 && mutedRef.current) setIsMuted(false);
    },
    [setStoredVolume, setIsMuted],
  );

  const toggleMute = useCallback(() => setIsMuted((current) => !current), [setIsMuted]);

  const toggleShuffle = useCallback(() => {
    setShuffle((current) => {
      const value = !current;
      playerRef.current?.setShuffle?.(value);
      return value;
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeat((current) => {
      const value = !current;
      playerRef.current?.setLoop?.(value);
      return value;
    });
  }, []);

  const retry = useCallback(() => {
    errorStreak.current = 0;
    setErrorMessage(null);
    setRetryToken((token) => token + 1);
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      status,
      errorMessage,
      playlist,
      track,
      trackIndex,
      trackCount,
      isPlaying,
      isBuffering,
      needsInteraction: !hasStarted,
      progress,
      duration,
      volume,
      isMuted,
      shuffle,
      repeat,
      play,
      pause,
      togglePlay,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      retry,
      registerHost: setHost,
    }),
    [
      status,
      errorMessage,
      playlist,
      track,
      trackIndex,
      trackCount,
      isPlaying,
      isBuffering,
      hasStarted,
      progress,
      duration,
      volume,
      isMuted,
      shuffle,
      repeat,
      play,
      pause,
      togglePlay,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      retry,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
