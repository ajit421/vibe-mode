import { useCallback, useEffect, useRef, useState } from 'react';
import { Music4, Play, Volume2 } from 'lucide-react';
import { usePlayer } from '@/state/player-context';
import { tidyTrackTitle } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * Every track in the loaded playlist, click to jump straight to it.
 *
 * ── Where the titles come from ─────────────────────────────────────────────
 * The IFrame API only tells us about the track that is *currently* loaded —
 * `getPlaylist()` returns bare video ids and nothing else. Titles for the rest
 * would normally mean the YouTube Data API, which needs a key, and a key can
 * never live in a `VITE_*` variable because Vite inlines those into the public
 * bundle.
 *
 * YouTube's oEmbed endpoint gives a title for a public video with no key and
 * no quota, so that is what fills the list in. A row that has not been
 * resolved yet shows its position rather than an empty line, and a lookup that
 * fails simply leaves it that way — a missing title never stops the row from
 * being clickable, which is the part that matters.
 *
 * Lookups are lazy: a row is only fetched once it scrolls into view, so a
 * ninety-track playlist costs a handful of requests rather than ninety.
 */
export function TrackList() {
  const { trackIds, trackIndex, playTrackAt, isPlaying, track } = usePlayer();
  const [titles, setTitles] = useState<Record<string, string>>({});

  // Ids already requested — including the ones that failed, so a dud lookup is
  // not retried on every scroll.
  const requested = useRef(new Set<string>());
  const listRef = useRef<HTMLOListElement>(null);

  // A new playlist means a new set of ids; the cache is keyed by id so it stays
  // valid, but the in-flight guard has to forget ids that are no longer shown.
  useEffect(() => {
    requested.current = new Set([...requested.current].filter((id) => trackIds.includes(id)));
  }, [trackIds]);

  const fetchTitle = useCallback(async (videoId: string) => {
    if (requested.current.has(videoId)) return;
    requested.current.add(videoId);

    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${videoId}`,
        )}`,
      );
      if (!response.ok) return;
      const data: unknown = await response.json();
      const title = (data as { title?: unknown })?.title;
      if (typeof title === 'string' && title) {
        setTitles((current) => ({ ...current, [videoId]: tidyTrackTitle(title) }));
      }
    } catch {
      /* Offline or blocked — the row keeps its position label. */
    }
  }, []);

  // Resolve the opening stretch up front. The observer below only reports rows
  // once the browser actually lays them out and paints them, which it declines
  // to do while the tab is in the background — so on a list left open in a
  // hidden tab nothing would ever resolve. This covers roughly the first
  // screenful; the observer takes over from there.
  useEffect(() => {
    for (const videoId of trackIds.slice(0, 12)) void fetchTitle(videoId);
  }, [trackIds, fetchTitle]);

  // Resolve titles for rows as they come into view.
  useEffect(() => {
    const root = listRef.current;
    if (!root || trackIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.videoId;
          if (id) void fetchTitle(id);
        }
      },
      { root, rootMargin: '120px' },
    );

    for (const row of root.querySelectorAll('[data-video-id]')) observer.observe(row);
    return () => observer.disconnect();
  }, [trackIds, fetchTitle]);

  // Follow the playing track, but only within the list — `scrollIntoView` on
  // the element itself would scroll the page behind it too.
  useEffect(() => {
    const root = listRef.current;
    const row = root?.querySelector<HTMLElement>(`[data-index="${trackIndex}"]`);
    if (!root || !row) return;

    const top = row.offsetTop - root.clientHeight / 2 + row.clientHeight / 2;
    root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [trackIndex, trackIds.length]);

  if (trackIds.length === 0) {
    return (
      <p className="font-mono text-xs text-muted">
        The tracklist appears once the playlist has loaded.
      </p>
    );
  }

  return (
    <ol
      ref={listRef}
      // Capped and scrolled internally: the player bar is fixed to the bottom
      // of a screen that never scrolls, so this list has to stay inside its own
      // box however many tracks the playlist has.
      className="vm-no-scrollbar max-h-[30vh] overflow-y-auto overscroll-contain rounded-xl border border-line/60 bg-canvas/40"
      aria-label="Tracks in this playlist"
    >
      {trackIds.map((videoId, index) => {
        const current = index === trackIndex;
        // Prefer the player's own title for the live row — it is faster and
        // more accurate than our lookup. Only when it is describing this exact
        // video, though: after a jump the index moves immediately while the
        // player is still on the old track, and trusting it blindly printed
        // the previous song's name against the newly selected row.
        const title = (track?.videoId === videoId ? track.title : null) ?? titles[videoId];

        return (
          <li key={`${videoId}-${index}`} data-video-id={videoId} data-index={index}>
            <button
              type="button"
              onClick={() => playTrackAt(index)}
              aria-current={current ? 'true' : undefined}
              className={cn(
                'group flex w-full items-center gap-3 border-b border-line/40 px-3 py-2 text-left transition-colors last:border-b-0',
                current ? 'bg-primary/12' : 'hover:bg-ink/6',
              )}
            >
              <span className="grid w-6 shrink-0 place-items-center">
                {current && isPlaying ? (
                  <Volume2 className="size-3.5 text-primary" aria-hidden="true" />
                ) : (
                  <>
                    <span
                      className={cn(
                        'font-mono text-[0.7rem] tabular-nums group-hover:hidden',
                        current ? 'text-primary' : 'text-muted',
                      )}
                    >
                      {index + 1}
                    </span>
                    <Play
                      className="hidden size-3 fill-current text-primary group-hover:block"
                      aria-hidden="true"
                    />
                  </>
                )}
              </span>

              <img
                src={`https://i.ytimg.com/vi/${videoId}/default.jpg`}
                alt=""
                aria-hidden="true"
                width={48}
                height={36}
                loading="lazy"
                decoding="async"
                className="h-8 w-12 shrink-0 rounded border border-line/60 object-cover"
              />

              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-xs',
                  current ? 'font-medium text-ink' : 'text-muted group-hover:text-ink',
                )}
              >
                {title ?? (
                  <span className="inline-flex items-center gap-1.5 text-muted/80">
                    <Music4 className="size-3" aria-hidden="true" />
                    Track {index + 1}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
