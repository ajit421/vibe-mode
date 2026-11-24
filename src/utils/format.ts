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
      // Uploaders sprinkle emoji through titles as decoration. They are the one
      // thing in the player we do not control the typography of, and a stray
      // colour glyph mid-title undoes the rest of the interface.
      // Matches whole sequences, not code points: a family or a flag is several
      // pictographs joined by zero-width joiners, and removing them one at a
      // time leaves the joiners behind as invisible debris in the string.
      .replace(/\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([),\]])/g, '$1')
      .trim() || title
  );
}
