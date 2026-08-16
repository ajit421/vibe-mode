/** Seconds → `m:ss` (or `h:mm:ss` for anything over an hour). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** A 10-cell block meter, e.g. `████████░░`. */
export function meterBar(value: number, cells = 10): string {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * cells);
  return '█'.repeat(filled) + '░'.repeat(cells - filled);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * YouTube titles are often padded with the uploader's SEO garnish. Trim the
 * most common patterns so the player bar reads like a track name.
 */
export function tidyTrackTitle(title: string): string {
  return (
    title
      .replace(/\s*[([](?:official\s*)?(?:music\s*)?(?:video|audio|lyric[s]?|visualizer)[^)\]]*[)\]]/gi, '')
      .replace(/\s*[|｜]\s*(?:official|lyrics?|full\s*video|hd|4k)\b.*$/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || title
  );
}
