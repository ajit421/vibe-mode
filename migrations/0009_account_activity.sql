-- Activity history per account, for the owner's admin page. Only for
-- visitors with a cloud copy who leave Settings → "Link my activity to my
-- account" on (the default; /privacy says so): their tab sends its device key
-- with the usage reports, and the server notes which profile the activity
-- belongs to. Everyone else stays anonymous exactly as in 0005–0007.
--
-- "Delete my cloud copy" removes the profile's listening history and unlinks
-- its visits (functions/api/profile.ts), leaving only anonymous counts behind.

-- Which account a visit belongs to, and the features used during it (JSON
-- [{ name, detail, n }]) — kept only for linked visits; anonymous visits keep
-- feature use as daily totals only (events_daily).
ALTER TABLE sessions ADD COLUMN profile_id TEXT;
ALTER TABLE sessions ADD COLUMN events TEXT;
CREATE INDEX IF NOT EXISTS sessions_profile ON sessions(profile_id);

-- Which account a playing tab belongs to, so its minutes can be credited to it.
ALTER TABLE listeners ADD COLUMN profile_id TEXT;

-- Listening per account, day, mode, playlist and song — the per-person twin
-- of listen_daily, written by the same pings (functions/api/listen.ts).
CREATE TABLE IF NOT EXISTS profile_listens (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  mode TEXT NOT NULL,
  mode_name TEXT,
  playlist TEXT NOT NULL,
  playlist_name TEXT,
  track TEXT NOT NULL,
  ms INTEGER NOT NULL,
  PRIMARY KEY (profile_id, day, mode, playlist, track)
);
