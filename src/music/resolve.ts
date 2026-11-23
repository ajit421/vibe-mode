import type { VibePlaylist } from '@/types/theme';

export type PlaylistSource =
  | { kind: 'playlist'; playlistId: string }
  | { kind: 'videos'; videoIds: string[] };

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{12,64}$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accepts a bare playlist ID or any YouTube URL containing `list=` and
 * returns a clean ID. Returns `null` when nothing usable is found, so callers
 * can show a validation message instead of silently loading nothing.
 */
export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.includes('list=')) {
    const match = /[?&]list=([A-Za-z0-9_-]+)/.exec(trimmed);
    if (match && PLAYLIST_ID_PATTERN.test(match[1])) return match[1];
    return null;
  }

  return PLAYLIST_ID_PATTERN.test(trimmed) ? trimmed : null;
}

/** Accepts a bare video ID or a watch/share URL. */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = /(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/.exec(trimmed);
  if (match) return match[1];

  return VIDEO_ID_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Turns what someone pasted into something the player can load: a playlist
 * link or id, or a comma-separated set of video links or ids. Returns null
 * when none of it parses, so the caller can say so rather than saving a
 * playlist that will never play.
 */
export function normaliseSource(input: string): string | null {
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

/**
 * A normalised source as `VibePlaylist` fields. Decided by whether it parses
 * as a playlist id — not by the presence of a comma, which got a single pasted
 * video wrong: it was stored as a playlist id, failed to parse as one, and the
 * playlist sat there "not configured" forever.
 */
export function sourceFields(
  source: string,
): Pick<VibePlaylist, 'youtubePlaylistId' | 'videoIds'> {
  return extractPlaylistId(source)
    ? { youtubePlaylistId: source, videoIds: undefined }
    : { youtubePlaylistId: undefined, videoIds: source.split(',') };
}

/**
 * Works out what the player should actually load.
 *
 * Precedence: a runtime override (set in the Settings panel) beats the
 * configured playlist ID, which beats an explicit `videoIds` list. Returns
 * `null` when the playlist has not been configured yet — the caller renders a
 * friendly setup hint rather than an error.
 */
export function resolvePlaylistSource(
  playlist: VibePlaylist | undefined,
  override?: string,
): PlaylistSource | null {
  if (!playlist) return null;

  const overrideId = override ? extractPlaylistId(override) : null;
  if (overrideId) return { kind: 'playlist', playlistId: overrideId };

  const configured = playlist.youtubePlaylistId?.trim();
  if (configured) {
    const id = extractPlaylistId(configured);
    if (id) return { kind: 'playlist', playlistId: id };
  }

  const videoIds = (playlist.videoIds ?? [])
    .map((value) => extractVideoId(value))
    .filter((value): value is string => value !== null);

  if (videoIds.length) return { kind: 'videos', videoIds };

  return null;
}

/** Stable key describing a source, used to avoid reloading the same playlist. */
export function sourceKey(source: PlaylistSource | null): string {
  if (!source) return 'none';
  return source.kind === 'playlist' ? `pl:${source.playlistId}` : `vid:${source.videoIds.join(',')}`;
}
