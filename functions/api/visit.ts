import { readText, type Handler } from '../../server/lib';
import { classify, countryOf, type Hints } from '../../server/ua';

// Counts a tab opening the site, by day, browser, system, device and country
// (migrations/0006_visits.sql). Anonymous: it adds 1 to a bucket and keeps
// nothing about who asked. Sent once per tab by src/components/ListenPing.tsx.
//
// Cost: one billed request and one D1 write per tab opened. Bots are left out
// (most don't run the page's script anyway). Like /api/listen, anyone can
// post here, so a script could inflate the counts — they are a guide, not a ledger.

export const onRequestPost: Handler = async ({ env, request }) => {
  let hints: Hints = {};
  try {
    const body = JSON.parse((await readText(request, 200)) ?? '{}');
    hints = { brave: body?.brave === true, touch: body?.touch === true };
  } catch {
    /* no hints: still counted, from the User-Agent alone */
  }
  const { browser, os, device } = classify(request.headers.get('User-Agent'), hints);
  if (device === 'bot') return new Response(null, { status: 204 });

  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT INTO visits (day, browser, os, device, country, count) VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT (day, browser, os, device, country) DO UPDATE SET count = count + 1`,
  )
    .bind(day, browser, os, device, countryOf(request))
    .run();
  return new Response(null, { status: 204 });
};
