-- What the site plays and shows before a visitor changes anything. Replaces the
-- VITE_PLAYLIST_* / VITE_IMAGE_* / VITE_POSTER_* variables that used to live in
-- `.env` and had to be baked in at build time.
--
-- Edit rows in the Cloudflare dashboard (Storage & databases → D1 → vibe-mode →
-- Console) or with `wrangler d1 execute`. Visitors get the change on their next
-- page load. There is no rebuild and no redeploy.
--
--   kind 'playlist'  id = playlist id in src/music/playlists.ts ('metro-vibes')
--                    value = a playlist id or link, or comma-separated video ids/links
--   kind 'image'     id = mode id in src/themes/ ('metro')
--                    value = '/backgrounds/metro.avif' or a full https:// URL;
--                    .mp4/.webm/.ogv/.m4v/.mov play as a looping video
--   kind 'poster'    id = mode id; a still for a video-backed mode's card
--
-- A missing row is fine: the playlist shows a setup hint, the mode shows its
-- colour gradient. Values are checked again in the browser (sanitizeDefaults),
-- so a typo here can never reach an `src` unsafely.
CREATE TABLE IF NOT EXISTS defaults (
  kind TEXT NOT NULL CHECK (kind IN ('playlist', 'image', 'poster')),
  id TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);
