-- Two more things for the owner's admin page, both described in Settings and
-- /privacy (src/utils/analytics.ts sends them; functions/api/session.ts stores them).

-- How fast the page loaded for this visit: navigation load time and Largest
-- Contentful Paint, in ms. Set once per visit; null when the browser can't say.
ALTER TABLE sessions ADD COLUMN load_ms INTEGER;
ALTER TABLE sessions ADD COLUMN lcp_ms INTEGER;

-- Returning visitors — only for browsers whose visitor said yes to "Allow
-- anonymous stats?" (asked once; changeable in Settings). The id is random,
-- made in the browser only after that yes, and kept here with nothing but the
-- first and last day it was seen and on how many days. Never joined to a
-- session, a profile, an IP or a device key.
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  first_day TEXT NOT NULL,   -- 'YYYY-MM-DD' (UTC)
  last_day TEXT NOT NULL,
  days INTEGER NOT NULL      -- distinct days seen
);
CREATE INDEX IF NOT EXISTS visitors_last_day ON visitors(last_day);
