import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
} from '@simplewebauthn/server';
import { caller, fail, json, type Handler } from '../../../server/lib';

// Step one of a passkey ceremony: a fresh challenge for the browser to sign.
//   { purpose: 'register' } — needs the caller's key; adds a passkey to their profile.
//   { purpose: 'login' }    — no key; any passkey made for this site may answer.
// The challenge is kept (5 minutes, one use) and checked by ./verify.ts.

const CHALLENGE_TTL_MS = 5 * 60_000;
/** Open to anyone, so bounded: a flood of logins can't grow the table without limit. */
const MAX_OPEN_CHALLENGES = 1_000;

export const onRequestPost: Handler = async ({ env, request }) => {
  const body = await request.json<{ purpose?: unknown }>().catch(() => null);
  const purpose = body?.purpose;
  if (purpose !== 'register' && purpose !== 'login') return fail(400, 'Unknown purpose.');

  const now = Date.now();
  await env.DB.prepare('DELETE FROM challenges WHERE expires_at < ?').bind(now).run();
  const open = await env.DB.prepare('SELECT COUNT(*) AS n FROM challenges').first<number>('n');
  if ((open ?? 0) >= MAX_OPEN_CHALLENGES) return fail(429, 'Busy. Try again in a few minutes.');

  // The passkey is bound to the site's own host name (`vibe-mode.pages.dev`).
  const rpID = new URL(request.url).hostname;
  let profileId: string | null = null;
  let options: unknown;

  if (purpose === 'register') {
    const who = await caller(env, request);
    if (!who) return fail(401, 'Save something first, then add a passkey.');
    profileId = who.profileId;
    const existing = await env.DB.prepare(
      'SELECT credential_id, transports FROM passkeys WHERE profile_id = ?',
    )
      .bind(profileId)
      .all<{ credential_id: string; transports: string | null }>();
    options = await generateRegistrationOptions({
      rpName: 'Vibe Mode',
      rpID,
      // Shown in the passkey manager. Nothing personal: there is no account name.
      userName: 'Vibe Mode',
      userDisplayName: 'Vibe Mode',
      userID: new TextEncoder().encode(profileId),
      attestationType: 'none',
      // Discoverable, so signing in on a new device needs no username first.
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      excludeCredentials: existing.results.map((row) => ({
        id: row.credential_id,
        transports: row.transports ? JSON.parse(row.transports) : undefined,
      })),
    });
  } else {
    options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
  }

  const challengeId = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO challenges (id, challenge, profile_id, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(challengeId, (options as { challenge: string }).challenge, profileId, now + CHALLENGE_TTL_MS)
    .run();
  return json({ challengeId, options });
};
