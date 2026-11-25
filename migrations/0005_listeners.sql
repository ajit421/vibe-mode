-- Anonymous "now playing" for the owner's admin page (functions/api/listen.ts).
-- A tab that is playing music says so once a minute, and once more when it
-- pauses. `tab` is a random id that lives only in that tab (sessionStorage):
-- no profile, no device key, no IP, nothing that names a person.
--
-- Only the present matters, so rows older than a few minutes are swept now
-- and then by the pings themselves. No index on purpose: the table only
-- ever holds the tabs playing right now, and an index would double the
-- billed writes of every ping.
CREATE TABLE IF NOT EXISTS listeners (
  tab TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  mode_name TEXT,
  playlist TEXT,
  playlist_name TEXT,
  track TEXT,
  playing INTEGER NOT NULL,
  seen_at INTEGER NOT NULL
);
