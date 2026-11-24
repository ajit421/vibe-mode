/**
 * One-time move from `.env` to the D1 `defaults` table: reads the old
 * VITE_PLAYLIST_* / VITE_IMAGE_* / VITE_POSTER_* lines and writes
 * `defaults.seed.sql` (gitignored — it holds playlist IDs, which never go in
 * the repo). Load it with:
 *
 *   npx wrangler d1 execute vibe-mode --remote --file=defaults.seed.sql
 *   (or --local, for `npm run preview:cf`)
 *
 * The id comes back from the variable name: VITE_PLAYLIST_METRO_VIBES →
 * 'metro-vibes', VITE_IMAGE_JUDAAD_HOUSE → 'judaad-house'. Blank values are
 * skipped. Running it twice is safe (INSERT OR REPLACE).
 *
 * Run with: npm run env-to-defaults
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KINDS = { PLAYLIST: 'playlist', IMAGE: 'image', POSTER: 'poster' };

let text;
try {
  text = readFileSync(resolve(ROOT, '.env'), 'utf8');
} catch {
  console.error('No .env in the project root — nothing to move.');
  process.exit(1);
}

const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const rows = [];

for (const line of text.split(/\r?\n/)) {
  const match = /^\s*VITE_(PLAYLIST|IMAGE|POSTER)_([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (!match) continue;
  const [, kind, name, raw] = match;
  const value = raw.replace(/^(['"])(.*)\1$/, '$2').trim();
  if (!value) continue;
  const id = name.toLowerCase().replaceAll('_', '-');
  rows.push(`INSERT OR REPLACE INTO defaults (kind, id, value) VALUES (${quote(KINDS[kind])}, ${quote(id)}, ${quote(value)});`);
}

if (!rows.length) {
  console.error('.env has no VITE_PLAYLIST_* / VITE_IMAGE_* / VITE_POSTER_* values.');
  process.exit(1);
}

writeFileSync(resolve(ROOT, 'defaults.seed.sql'), `${rows.join('\n')}\n`);
console.log(`Wrote ${rows.length} rows to defaults.seed.sql.`);
