-- Browsers, systems, devices and countries for the owner's admin page —
-- as anonymous counts. server/ua.ts turns the request's User-Agent into
-- coarse buckets ('Chrome', 'Android', 'mobile'); the header itself, the IP
-- and anything else that could single a person out are never stored.

-- One row per day and bucket, counting tabs that opened the site
-- (functions/api/visit.ts, once per tab). No row is about a person.
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL,          -- 'YYYY-MM-DD', UTC
  browser TEXT NOT NULL,
  os TEXT NOT NULL,
  device TEXT NOT NULL,       -- 'mobile' | 'tablet' | 'desktop'
  country TEXT NOT NULL,      -- two letters from Cloudflare, 'XX' unknown
  count INTEGER NOT NULL,
  PRIMARY KEY (day, browser, os, device, country)
);

-- The same buckets on each anonymous "now playing" row (0005).
ALTER TABLE listeners ADD COLUMN browser TEXT;
ALTER TABLE listeners ADD COLUMN os TEXT;
ALTER TABLE listeners ADD COLUMN device TEXT;
ALTER TABLE listeners ADD COLUMN country TEXT;
