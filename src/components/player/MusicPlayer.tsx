import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
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
import { TrackList } from './TrackList';
import { formatTime } from '@/utils/format';
import { buildShareUrl } from '@/utils/url';
import { cn } from '@/utils/cn';

interface MusicPlayerProps {
  onOpenSettings: () => void;
  /** Where playlists are added and fixed. */
  onOpenCustomize: () => void;
}

export function MusicPlayer({ onOpenSettings, onOpenCustomize }: MusicPlayerProps) {
  const player = usePlayer();
  const { theme, playlist, motionEnabled, hasEntered } = useVibe();
  const ThemeIcon = theme.icon;
  const { push } = useToast();
  const [expanded, setExpanded] = useState(false);
  // Shrinks the bar to a turning disc and a play button, so the artwork behind
  // it gets the whole screen. Everything the bar drops is still reachable —
  // restoring is one click, and the keyboard shortcuts never stop working.
  const [minimised, setMinimised] = useState(false);
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
      ? // The `defaults` table means nothing to a visitor; it is the
        // developer's hint, so it only appears in development.
        import.meta.env.DEV
        ? `Add a 'playlist' row '${playlist.id}' to the D1 defaults table, or its link in Customize`
        : 'Add its link in Customize'
      : `No playlists in ${theme.name} — add one in Customize`
    : // A transient message (e.g. skipping an un-embeddable track) still needs
      // to surface even while the player is otherwise healthy.
      (errorMessage ??
      [playlist?.name, trackCount > 0 ? `Track ${trackIndex + 1} of ${trackCount}` : null]
        .filter(Boolean)
        .join(' · '));

  return (
    <m.footer
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 z-60"
      initial={false}
      animate={{ y: hasEntered ? 0 : '110%' }}
      transition={{ type: 'spring', stiffness: 260, damping: 32 }}
      aria-label="Music player"
    >
      <div
        className={cn(
          'vm-panel transition-[border-radius] duration-300',
          minimised
            ? // A pill centred over the bottom of the artwork rather than a bar
              // pinned across it. `max-w` keeps it inside the viewport once the
              // track name is long, and the name truncates rather than pushing
              // the pill wider than the screen.
              'mx-auto w-fit max-w-[calc(100vw-1.5rem)] rounded-full shadow-[0_8px_30px_-8px_rgba(0,0,0,0.7)]'
            : 'rounded-t-2xl border-x-0 border-b-0 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.7)]',
        )}
        style={minimised ? { marginBottom: 'calc(1rem + var(--safe-bottom))' } : undefined}
      >
        {/* ── Expanded drawer ────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {expanded && (
            <m.div
              key="drawer"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-b border-line/60"
            >
              {/* Capped to the screen: on a phone held sideways the drawer was
                  taller than the space above the controls, so the fixed footer
                  grew past the top of the screen and its own buttons were out
                  of reach. It scrolls inside itself instead, like the tracklist. */}
              {/* 10rem + the bottom inset: 9rem only just covered the bar
                  below with a mouse; a touch screen's taller slider and the
                  home-indicator inset pushed the drawer's top off-screen. */}
              <div className="flex max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-10rem)] flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
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

                <div>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p className="vm-label text-muted">Tracklist</p>
                    {trackCount > 0 && (
                      <span className="font-mono text-[0.65rem] text-muted tabular-nums">
                        {trackIndex + 1} / {trackCount}
                      </span>
                    )}
                  </div>
                  <TrackList />
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* ── Progress ───────────────────────────────────────────────────── */}
        {/* Rendered conditionally rather than hidden: a `false` still occupies
            its slot, so the row below keeps its position in the tree and the
            embed inside it is never remounted. */}
        {!minimised && (
          <div className="flex items-center gap-3 px-4 pt-2 sm:px-6">
            <span className="w-10 shrink-0 text-right font-mono text-xs text-muted tabular-nums">
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
            <span className="w-10 shrink-0 font-mono text-xs text-muted tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        )}

        {/* ── Main row ───────────────────────────────────────────────────── */}
        {/* The extra bottom padding clears the home indicator on notched
            phones — without it the transport buttons sit underneath it. */}
        {/* From `lg` the full bar is three columns — track on the left,
            transport dead centre, the rest on the right — so the play button
            sits in the same place whatever the track is called. The left and
            right groups are wrappers in every state, never added or removed,
            so the cover art (and the embed inside it) keeps one place in the
            tree. */}
        <div
          className={cn(
            'flex items-center',
            minimised
              ? 'gap-2 p-2'
              : 'gap-3 px-3 pb-3 sm:gap-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
          )}
          style={minimised ? undefined : { paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
        >
          <div className={cn('flex min-w-0 items-center', minimised ? 'gap-2' : 'flex-1 gap-3 sm:gap-4')}>
          {/* Cover art, turning like a record. Square and circular in every
              state — a rotating rectangle just reads as broken.

              This element must stay mounted and in the same place in the tree
              no matter which state the bar is in. It holds the YouTube embed,
              and `registerHost` swapping to a different node would tear the
              player down and restart the track from zero — which is exactly
              what minimising must not do. */}
          <div
            className={cn(
              'relative shrink-0 overflow-hidden rounded-full border border-line bg-canvas-2 transition-[width,height] duration-300',
              minimised ? 'size-14' : expanded ? 'size-[74px] sm:size-[104px]' : 'size-11 sm:size-12',
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

            {/* Always painted, under the cover: a new thumbnail is transparent
                until it loads (every playlist switch mounts one), and with the
                fallback only drawn *instead* of the image, the playing video
                showed through the disc in that gap. */}
            <div className="absolute inset-0 grid place-items-center bg-canvas-2">
              <ThemeIcon className="size-5 text-muted" strokeWidth={1.25} aria-hidden="true" />
            </div>
            {thumbnailUrl && !artworkFailed && (
              <img
                src={thumbnailUrl}
                alt=""
                width={320}
                height={180}
                loading="lazy"
                decoding="async"
                onError={() => setArtworkFailed(true)}
                data-spinning={isPlaying ? 'true' : 'false'}
                className="vm-record absolute inset-0 h-full w-full rounded-full object-cover"
              />
            )}

            {/* The spindle. Sells the record read at a glance, and gives the
                spin a visible centre — a photo rotating about nothing in
                particular just looks like a glitch. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 size-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-canvas/85 ring-1 ring-ink/15"
            />

            {isBuffering && (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45">
                <Loader2 className="size-4 animate-spin text-primary" />
              </span>
            )}
          </div>

          {/* Track text. Minimised keeps the name — a disc with no title tells
              you something is playing but not what — and drops the second line,
              which is the playlist and position rather than the song. */}
          <div className={cn('min-w-0', minimised ? 'max-w-[42vw] sm:max-w-[20rem]' : 'flex-1')}>
            <p
              className={cn(
                'truncate text-sm font-medium',
                unconfigured || errored ? 'text-primary' : 'text-ink',
              )}
              title={primaryLine}
            >
              {primaryLine}
            </p>
            {!minimised && (
              <p className="mt-0.5 truncate text-xs text-muted" title={secondaryLine ?? undefined}>
                {secondaryLine}
              </p>
            )}
          </div>
          </div>

          {/* Transport */}
          <div className="flex items-center gap-0.5 sm:gap-1 lg:gap-2">
            {/* Wrapped rather than given `hidden sm:inline-flex` directly:
                `cn` is plain clsx, so a `hidden` passed in loses to the
                `inline-flex` baked into IconButton's own base classes and the
                button stays visible. `contents` keeps the flex row unchanged
                at sm and up. */}
            {/* Minimised shows it at every width: the pill is the only control
                left on screen, so losing skip-back on a phone would mean the
                shortcut keys are the only way back a track. */}
            <span className={minimised ? 'contents' : 'hidden sm:contents'}>
              {/* Not disabled on an error: when YouTube rejects a track before
                  the list has loaded, the player can't skip on its own, and a
                  locked Next left the visitor stuck on a dead track. */}
              <IconButton
                label="Previous track"
                onClick={player.previous}
                disabled={unconfigured}
              >
                <SkipBack />
              </IconButton>
            </span>

            {unconfigured ? (
              <IconButton
                label="Set up a playlist"
                variant="solid"
                size="lg"
                onClick={onOpenCustomize}
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
                  // A soft halo in the mode's glow colour: the one control
                  // that should find the eye first.
                  'shadow-[0_0_26px_-6px_var(--c-glow)] hover:scale-105',
                )}
              >
                {isPlaying ? <Pause /> : <Play className="translate-x-px" />}
              </IconButton>
            )}

            <IconButton label="Next track" onClick={player.next} disabled={unconfigured}>
              <SkipForward />
            </IconButton>
          </div>

          <div className="flex items-center justify-end gap-1">
          {/* Secondary controls — desktop only, everything here is also in
              Settings or the expanded drawer for small screens. */}
          <div className={cn('hidden items-center gap-1', !minimised && 'lg:flex')}>
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

          {!minimised && (
            <IconButton
              label={expanded ? 'Collapse player' : 'Expand player'}
              size="sm"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? <ChevronDown /> : <ChevronUp />}
            </IconButton>
          )}

          <IconButton
            label={minimised ? 'Restore player' : 'Minimise player'}
            size="sm"
            onClick={() => {
              // The drawer belongs to the full bar; leaving it open would have
              // it spring back the moment the player is restored.
              if (!minimised) setExpanded(false);
              setMinimised((current) => !current);
            }}
          >
            {minimised ? <Maximize2 /> : <Minimize2 />}
          </IconButton>
          </div>
        </div>
      </div>
    </m.footer>
  );
}
