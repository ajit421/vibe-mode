-- Visitors' own changes, saved so they come back on the next visit and on
-- other devices. No account, no email, no password: the browser holds a long
-- random key (see src/sync/), and only its SHA-256 is stored here, so a copy
-- of this database grants access to nothing.
--
-- A profile can have several device keys: one per browser, plus one minted
-- for each sync link (phase 3) and each passkey sign-in (phase 4). "Sign out
-- other devices" deletes every key but the caller's.

-- `data` is the backup shape minus pictures: customization, preferences,
-- customPlaylists, playlistOverrides. The browser sanitises it on the way in,
-- exactly like a restored backup file.
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS device_keys (
  key_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS device_keys_profile ON device_keys(profile_id);

-- Uploaded stills, one row per mode, apart from `data` so a text edit never
-- rewrites half a megabyte. Each is a `data:image/…` URL of at most 1.5 MB.
-- shortcut: pictures live in D1, not R2 (R2 isn't enabled on the account);
-- fine while there are hundreds of them, move to R2 well before the
-- database nears its size limit.
CREATE TABLE IF NOT EXISTS uploads (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode_id TEXT NOT NULL,
  still TEXT NOT NULL,
  PRIMARY KEY (profile_id, mode_id)
);

-- Passkeys (phase 4): a way back into a profile from a new device without a
-- sync link. `public_key` is base64url COSE, as @simplewebauthn returns it.
CREATE TABLE IF NOT EXISTS passkeys (
  credential_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS passkeys_profile ON passkeys(profile_id);

-- One-time WebAuthn challenges, deleted on use and swept when expired.
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  profile_id TEXT,
  expires_at INTEGER NOT NULL
);
