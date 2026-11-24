import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  addKey,
  base64UrlToBytes,
  bytesToBase64Url,
  caller,
  fail,
  json,
  type Handler,
} from '../../../server/lib';

// Step two of a passkey ceremony: check the browser's signed answer against
// the challenge from ./options.ts (used once, whatever the outcome).
//   A registration challenge (it carries a profile) stores the new passkey.
//   A sign-in challenge (no profile) looks up the passkey that answered and
//   mints a fresh device key for its profile — the browser's way back in.

interface Body {
  challengeId?: unknown;
  response?: unknown;
}

export const onRequestPost: Handler = async ({ env, request }) => {
  const body = await request.json<Body>().catch(() => null);
  if (typeof body?.challengeId !== 'string' || typeof body.response !== 'object' || !body.response) {
    return fail(400, 'Bad request.');
  }

  const challenge = await env.DB.prepare(
    'DELETE FROM challenges WHERE id = ? RETURNING challenge, profile_id, expires_at',
  )
    .bind(body.challengeId)
    .first<{ challenge: string; profile_id: string | null; expires_at: number }>();
  if (!challenge || challenge.expires_at < Date.now()) return fail(400, 'That took too long. Try again.');

  const url = new URL(request.url);
  const expected = {
    expectedChallenge: challenge.challenge,
    expectedOrigin: url.origin,
    expectedRPID: url.hostname,
    requireUserVerification: false,
  };

  try {
    if (challenge.profile_id) {
      const who = await caller(env, request);
      if (!who || who.profileId !== challenge.profile_id) return fail(401, 'Unknown key.');

      const result = await verifyRegistrationResponse({
        ...expected,
        response: body.response as RegistrationResponseJSON,
      });
      if (!result.verified) return fail(400, 'That passkey could not be checked.');
      const { credential } = result.registrationInfo;
      await env.DB.prepare(
        `INSERT INTO passkeys (credential_id, profile_id, public_key, counter, transports, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          credential.id,
          who.profileId,
          bytesToBase64Url(credential.publicKey),
          credential.counter,
          JSON.stringify(credential.transports ?? []),
          Date.now(),
        )
        .run();
      return json({ ok: true }, 201);
    }

    const response = body.response as AuthenticationResponseJSON;
    const passkey = await env.DB.prepare(
      'SELECT profile_id, public_key, counter, transports FROM passkeys WHERE credential_id = ?',
    )
      .bind(String(response.id))
      .first<{ profile_id: string; public_key: string; counter: number; transports: string | null }>();
    if (!passkey) return fail(401, 'That passkey isn’t known here — it may have been deleted.');

    const result = await verifyAuthenticationResponse({
      ...expected,
      response,
      credential: {
        id: String(response.id),
        publicKey: base64UrlToBytes(passkey.public_key),
        counter: passkey.counter,
        transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
      },
    });
    if (!result.verified) return fail(401, 'That passkey could not be checked.');

    await env.DB.prepare('UPDATE passkeys SET counter = ? WHERE credential_id = ?')
      .bind(result.authenticationInfo.newCounter, String(response.id))
      .run();
    const key = await addKey(env, passkey.profile_id);
    if (!key) return fail(429, 'Too many devices. Sign out the other devices from one you have.');
    return json({ key });
  } catch {
    // The library throws on any mismatch (origin, challenge, signature…).
    return fail(400, 'That passkey could not be checked.');
  }
};
