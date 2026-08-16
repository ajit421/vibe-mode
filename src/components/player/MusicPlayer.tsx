import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link2,
  Loader2,
  Pause,
  Play,
  Repeat,
  RotateCw,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayer } from '@/state/player-context';
import { useVibe } from '@/state/vibe-context';
import { useToast } from '@/state/toast-context';
import { IconButton } from '@/components/ui/IconButton';
import { Slider } from '@/components/ui/Slider';
import { PlaylistChips } from './PlaylistChips';
import { envVarFor } from '@/music/playlists';
import { formatTime } from '@/utils/format';
import { buildShareUrl } from '@/utils/url';
import { cn } from '@/utils/cn';

interface MusicPlayerProps {
  onOpenSettings: () => void;
}

export function MusicPlayer({ onOpenSettings }: MusicPlayerProps) {
  const player = usePlayer();
  const { theme, playlist, motionEnabled, hasEntered } = useVibe();
  const ThemeIcon = theme.icon;
  const { push } = useToast();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  const {
    status,
    errorMessage,
    track,
    trackIndex,
    trackCount,
    isPlaying,
    isBuffering,
    needsInteraction,
    progress,
    duration,
    volume,
    isMuted,
    shuffle,
    repeat,
  } = player;

  // Keep the rest of the page clear of the bar, whatever height it ends up.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        '--player-height',
        `${Math.round(entry.contentRect.height)}px`,
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const unconfigured = status === 'unconfigured';
  const errored = status === 'error';
  const controlsDisabled = unconfigured || errored;

  // `mqdefault` is the only still that is a true 16:9 crop and exists for every
  // video — `hqdefault` is 4:3 with black bars, `maxresdefault` 404s on plenty
  // of tracks. At ~10kB it costs less than a second of the video we're no
  // longer showing.
  const thumbnailUrl =
    track?.videoId && !unconfigured && !errored
      ? `https://i.ytimg.com/vi/${encodeURIComponent(track.videoId)}/mqdefault.jpg`
      : null;

  // A pulled or region-locked video still resolves a videoId but has no still,
  // so fall back to the mode's icon rather than leaving a broken image.
  const [artworkFailed, setArtworkFailed] = useState(false);
  useEffect(() => setArtworkFailed(false), [thumbnailUrl]);

  const share = async () => {
    const url = buildShareUrl({ mode: theme.id, playlist: playlist?.id ?? null });
    try {
      await navigator.clipboard.writeText(url);
      push('Link copied. Send someone your vibe.', 'SHARED');
    } catch {
      push(url, 'LINK');
    }
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  const primaryLine = unconfigured
    ? 'Playlist not set up yet'
    : errored
      ? 'Playback stopped'
      : (track?.title ?? (status === 'loading' ? 'Loading…' : 'Press play to start the vibe'));

  const secondaryLine = unconfigured
    ? playlist
      ? `Set ${envVarFor(playlist.id)} in .env, or add your own from Settings`
      : `No playlists configured for ${theme.name}`
    : // A transient message (e.g. skipping an un-embeddable track) still needs
      // to surface even while the player is otherwise healthy.
      (errorMessage ??
      [playlist?.name, trackCount > 0 ? `Track ${trackIndex + 1} of ${trackCount}` : null]
        .filter(Boolean)
        .join(' · '));

  return (
    <motion.footer
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 z-60"
      initial={false}
      animate={{ y: hasEntered ? 0 : '110%' }}
      transition={{ type: 'spring', stiffness: 260, damping: 32 }}
      aria-label="Music player"
    >
      <div className="vm-panel rounded-t-2xl border-x-0 border-b-0 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.7)]">
        {/* ── Expanded drawer ────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="drawer"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-b border-line/60"
            >
              <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="vm-label text-muted">Now playing in</p>
                    <p className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-ink">
                      <ThemeIcon className="size-4 text-primary" aria-hidden="true" />
                      {theme.name}
                    </p>
                    {playlist?.description && (
                      <p className="mt-1 max-w-md text-sm text-muted">{playlist.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <IconButton label="Copy a link to this vibe" size="sm" onClick={share}>
                      <Link2 />
                    </IconButton>
                    {track && (
                      <a
                        href={track.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        title="Open this track on YouTube"
                        aria-label="Open this track on YouTube"
                        className="inline-flex size-9 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-ink/8 hover:text-ink [&_svg]:size-4"
                      >
                        <ExternalLink />
                      </a>
                    )}
                    <IconButton label="Open settings" size="sm" onClick={onOpenSettings}>
                      <Settings2 />
                    </IconButton>
                  </div>
                </div>

                <div>
                  <p className="vm-label mb-2 text-muted">Playlists in this mode</p>
                  <PlaylistChips variant="hero" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Progress ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pt-2 sm:px-6">
          <span className="w-10 shrink-0 text-right font-mono text-[0.65rem] text-muted tabular-nums">
            {formatTime(progress)}
          </span>
          <Slider
            label="Seek"
            value={progress}
            max={duration}
            step={1}
            disabled={controlsDisabled || duration === 0}
            onChange={player.seek}
            valueText={`${formatTime(progress)} of ${formatTime(duration)}`}
            className="flex-1"
          />
          <span className="w-10 shrink-0 font-mono text-[0.65rem] text-muted tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        {/* ── Main row ───────────────────────────────────────────────────── */}
        {/* The extra bottom padding clears the home indicator on notched
            phones — without it the transport buttons sit underneath it. */}
        <div
          className="flex items-center gap-3 px-3 pb-3 sm:gap-4 sm:px-6"
          style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
        >
          {/* Cover art. The YouTube player sits underneath, painted but fully
              covered — see the note on the host div below. */}
          <div
            className={cn(
              'relative shrink-0 overflow-hidden rounded-lg border border-line bg-canvas-2 transition-[width,height] duration-300',
              expanded
                ? 'h-[74px] w-[132px] sm:h-[104px] sm:w-[185px]'
                : 'h-11 w-[68px] sm:h-12 sm:w-[85px]',
            )}
          >
            {/* The embed has to stay in the layout and stay painted: YouTube
                refuses to play from a `display:none` or zero-sized iframe. So
                it keeps its box and the artwork is drawn over the top of it,
                which is also why the box stays this small — YouTube picks its
                video rendition from the player size, so a thumbnail-sized
                player means it streams the lowest one and spends almost all
                the bandwidth on audio. */}
            <div
              ref={player.registerHost}
              className="pointer-events-none absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full"
            />

            {thumbnailUrl && !artworkFailed ? (
              <img
                src={thumbnailUrl}
                alt=""
                width={320}
                height={180}
                loading="lazy"
                decoding="async"
                onError={() => setArtworkFailed(true)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-canvas-2">
                <ThemeIcon className="size-5 text-muted" strokeWidth={1.25} aria-hidden="true" />
              </div>
            )}

            {isBuffering && (
              <span className="absolute inset-0 grid place-items-center bg-black/45">
                <Loader2 className="size-4 animate-spin text-primary" />
              </span>
            )}
          </div>

          {/* Track text */}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-medium',
                unconfigured || errored ? 'text-primary' : 'text-ink',
              )}
              title={primaryLine}
            >
              {primaryLine}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted" title={secondaryLine ?? undefined}>
              {secondaryLine}
            </p>
          </div>

          {/* Transport */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Wrapped rather than given `hidden sm:inline-flex` directly:
                `cn` is plain clsx, so a `hidden` passed in loses to the
                `inline-flex` baked into IconButton's own base classes and the
                button stays visible. `contents` keeps the flex row unchanged
                at sm and up. */}
            <span className="hidden sm:contents">
              <IconButton
                label="Previous track"
                onClick={player.previous}
                disabled={controlsDisabled}
              >
                <SkipBack />
              </IconButton>
            </span>

            {unconfigured ? (
              <IconButton
                label="Set up a playlist"
                variant="solid"
                size="lg"
                onClick={onOpenSettings}
              >
                <Settings2 />
              </IconButton>
            ) : errored ? (
              <IconButton label="Try again" variant="solid" size="lg" onClick={player.retry}>
                <RotateCw />
              </IconButton>
            ) : (
              <IconButton
                label={isPlaying ? 'Pause' : 'Play'}
                variant="solid"
                size="lg"
                onClick={player.togglePlay}
                className={cn(
                  needsInteraction && motionEnabled && 'animate-pulse',
                  'shadow-glow/30',
                )}
              >
                {isPlaying ? <Pause /> : <Play className="translate-x-px" />}
              </IconButton>
            )}

            <IconButton label="Next track" onClick={player.next} disabled={controlsDisabled}>
              <SkipForward />
            </IconButton>
          </div>

          {/* Secondary controls — desktop only, everything here is also in
              Settings or the expanded drawer for small screens. */}
          <div className="hidden items-center gap-1 lg:flex">
            <IconButton
              label="Shuffle"
              size="sm"
              active={shuffle}
              onClick={player.toggleShuffle}
              disabled={controlsDisabled}
            >
              <Shuffle />
            </IconButton>
            <IconButton
              label="Repeat playlist"
              size="sm"
              active={repeat}
              onClick={player.toggleRepeat}
              disabled={controlsDisabled}
            >
              <Repeat />
            </IconButton>

            <div className="ml-1 flex items-center gap-1.5">
              <IconButton label={isMuted ? 'Unmute' : 'Mute'} size="sm" onClick={player.toggleMute}>
                <VolumeIcon />
              </IconButton>
              <Slider
                label="Volume"
                value={isMuted ? 0 : volume}
                max={100}
                onChange={player.setVolume}
                valueText={`${isMuted ? 0 : volume} percent`}
                className="w-24"
              />
            </div>
          </div>

          <IconButton
            label={expanded ? 'Collapse player' : 'Expand player'}
            size="sm"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <ChevronDown /> : <ChevronUp />}
          </IconButton>
        </div>
      </div>
    </motion.footer>
  );
}
