-- "Continue with Google": one more way back into a profile from a new device,
-- beside sync links, passkeys and passwords (functions/api/google.ts). A
-- signed-in Google account mints a device key for the profile it is linked
-- to, exactly like a passkey sign-in, so everything after is the usual key.
--
-- `sub` is Google's permanent id for the account (not the email, which can
-- change). `email` is shown to the visitor so they know which account is
-- linked, and on the owner's admin page; /privacy says so.
-- One Google account per profile, one profile per Google account.
CREATE TABLE IF NOT EXISTS google_accounts (
  sub TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT,
  created_at INTEGER NOT NULL
);
