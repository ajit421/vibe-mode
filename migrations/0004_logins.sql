-- Username + password: one more way back into a profile from a new device,
-- beside sync links and passkeys. Optional — the site never asks for it.
-- A correct password mints a device key (functions/api/login.ts), exactly
-- like a passkey sign-in, so everything after it is the usual Bearer key.
--
-- The password never reaches the server: the browser stretches it with 600k
-- PBKDF2 rounds (src/sync/password.ts) and sends that. `hash` is a further
-- PBKDF2-SHA256 (hex) of it over a per-login random `salt` (base64url).
-- `iterations` is kept per row so the count can change later.
-- One login per profile; usernames are case-insensitive.
CREATE TABLE IF NOT EXISTS logins (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Sign-in tries per username in the current window, for the lockout —
-- counted before checking, cleared by a right answer. (The table name is
-- older than that.) Unknown usernames are counted too, so the lockout says
-- nothing about which names exist. Expired rows are swept on each try.
CREATE TABLE IF NOT EXISTS login_failures (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  count INTEGER NOT NULL,
  since INTEGER NOT NULL
);
