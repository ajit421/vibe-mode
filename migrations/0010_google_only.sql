-- Google becomes the only way into a cloud account ("premium": cloud save,
-- linked devices, AI assistants). Anonymous cloud copies are no longer made;
-- a browser that already has one keeps its key, and signing in with Google
-- links it (functions/api/google.ts). Password and passkey sign-in are gone
-- from the code; their old tables (0002 passkeys/challenges, 0004 logins)
-- are left in place, unused, and emptied by profile deletion.

-- Shown on the profile icon and in the Account panel. From the verified
-- Google token; refreshed on each sign-in.
ALTER TABLE google_accounts ADD COLUMN name TEXT;
ALTER TABLE google_accounts ADD COLUMN picture TEXT;

-- The personal MCP server at /mcp signs assistants in with OAuth 2.1
-- (functions/api/oauth/*). An app registers itself once (dynamic client
-- registration), then gets a one-time code after the visitor signs in with
-- Google and approves, and trades it for an access token — a device key of
-- the visitor's profile, so "Sign out other devices" revokes it too.
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  name TEXT,
  redirect_uris TEXT NOT NULL,   -- JSON array of exact URLs
  created_at INTEGER NOT NULL
);

-- One-time codes: hashed, bound to client, redirect and PKCE challenge, five minutes.
CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
