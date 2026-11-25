import { describe, expect, it } from 'vitest';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { verifyGoogle } from './google';

/*
 * Google's side is stood in for by a key pair made here: tokens are signed
 * with it, and the verifier is handed its public half instead of Google's.
 */

const CLIENT = '123-test.apps.googleusercontent.com';
const google = await generateKeyPair('RS256');
const stranger = await generateKeyPair('RS256');
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(google.publicKey)), kid: 'g1', alg: 'RS256' }] });

const token = (claims: Record<string, unknown> = {}, key = google.privateKey, expires: string | number = '1h') =>
  new SignJWT({ email: 'asha@example.com', email_verified: true, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'g1' })
    .setIssuer('https://accounts.google.com')
    .setAudience(CLIENT)
    .setSubject('google-sub-1')
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(key);

describe('verifyGoogle', () => {
  it('accepts a token Google signed for this site, with the verified email', async () => {
    expect(await verifyGoogle(await token(), CLIENT, keys)).toEqual({ sub: 'google-sub-1', email: 'asha@example.com' });
  });

  it('keeps an unverified email out', async () => {
    expect(await verifyGoogle(await token({ email_verified: false }), CLIENT, keys)).toEqual({
      sub: 'google-sub-1',
      email: null,
    });
  });

  it('refuses another site’s token, an expired one, a forged one, and junk', async () => {
    expect(await verifyGoogle(await token(), 'someone-else.apps.googleusercontent.com', keys)).toBeNull();
    expect(await verifyGoogle(await token({}, google.privateKey, Math.floor(Date.now() / 1000) - 3600), CLIENT, keys)).toBeNull();
    expect(await verifyGoogle(await token({}, stranger.privateKey), CLIENT, keys)).toBeNull();
    expect(await verifyGoogle('not.a.token', CLIENT, keys)).toBeNull();
  });

  it('refuses a token from any other issuer', async () => {
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'g1' })
      .setIssuer('https://evil.example')
      .setAudience(CLIENT)
      .setSubject('x')
      .setExpirationTime('1h')
      .sign(google.privateKey);
    expect(await verifyGoogle(forged, CLIENT, keys)).toBeNull();
  });
});
