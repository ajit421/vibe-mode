-- Live player control from an AI assistant (functions/mcp/, functions/api/remote.ts).
-- An open tab with "Let AI control this tab" on polls /api/remote every few
-- seconds: it reports what it is playing and collects the commands queued
-- for it here. Nothing polls unless a visitor switches that on.

-- What the listening tab last reported, and when it was last heard from.
CREATE TABLE IF NOT EXISTS remote_state (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  seen_at INTEGER NOT NULL
);

-- Commands waiting for the tab. Taken (and deleted) on its next poll;
-- anything older than two minutes is dropped rather than replayed late.
CREATE TABLE IF NOT EXISTS remote_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  value TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS remote_commands_profile ON remote_commands(profile_id);
