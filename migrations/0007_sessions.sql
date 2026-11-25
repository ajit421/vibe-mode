-- How long people stay, how long they listen, to what, and which features
-- they use — for the owner's admin page. Still anonymous: a "session" is one
-- browser tab's visit, keyed by the random per-tab id that lives only in that
-- tab's sessionStorage (src/components/Analytics.tsx). Nothing here ties two
-- sessions together or to a profile, a name or an IP.

-- One row per tab visit, written by functions/api/session.ts when the tab is
-- hidden or closed. Times are totals for the visit so far, so a repeated or
-- lost report never double-counts (each update keeps the larger value).
CREATE TABLE IF NOT EXISTS sessions (
  tab TEXT PRIMARY KEY,
  day TEXT NOT NULL,              -- 'YYYY-MM-DD' (UTC) the visit started
  started_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  open_ms INTEGER NOT NULL,       -- tab open
  visible_ms INTEGER NOT NULL,    -- tab on screen
  listened_ms INTEGER NOT NULL,   -- music playing
  first_mode TEXT,
  browser TEXT,
  os TEXT,
  device TEXT,
  country TEXT
);
-- For the admin page's date ranges and the sweep. `day` never changes after
-- the insert, so updates don't pay for this index.
CREATE INDEX IF NOT EXISTS sessions_day ON sessions(day);

-- Listening time per day, mode, playlist and song, added by every
-- "now playing" ping (functions/api/listen.ts) for the time since the last one.
CREATE TABLE IF NOT EXISTS listen_daily (
  day TEXT NOT NULL,
  mode TEXT NOT NULL,
  playlist TEXT NOT NULL,         -- '' when none
  track TEXT NOT NULL,            -- '' when unknown
  ms INTEGER NOT NULL,
  mode_name TEXT,                 -- latest names, for display: ids like my-3fa1… mean nothing
  playlist_name TEXT,
  PRIMARY KEY (day, mode, playlist, track)
);

-- Feature use per day: ('panel', 'Customize') → 12. Sent in batches with the
-- session report, so counting a click costs no request of its own.
CREATE TABLE IF NOT EXISTS events_daily (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  detail TEXT NOT NULL,           -- '' when none
  count INTEGER NOT NULL,
  PRIMARY KEY (day, name, detail)
);
