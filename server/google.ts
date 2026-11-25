import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/*
 * Checks a "Sign in with Google" ID token — the signed note Google hands the
 * browser after the visitor picks an account. jose, not hand-written crypto:
 * a mistake here would let anyone sign in as anyone.
 *
 * Accepted only when all of these hold:
 *  - signed by one of Google's current keys (fetched from Google, cached per isolate);
 *  - issued by Google (`iss`), for this site's Client ID (`aud`), not expired (`exp`);
 *  - it names an account (`sub`).
 * The email is kept only when Google says it is verified. The name and the
 * picture (an https URL on Google's own image hosts) are for the profile icon.
 */

const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleAccount {
  /** Google's permanent id for the account. */
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/** Google's profile pictures live on googleusercontent.com; anything else isn't shown. */
const PICTURE = /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\/[^\s"'<>]{1,500}$/;

/** The account a token proves, or null for any token that isn't valid for this site. */
export async function verifyGoogle(
  token: string,
  clientId: string,
  keys: JWTVerifyGetKey = GOOGLE_KEYS,
): Promise<GoogleAccount | null> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: ISSUERS,
      audience: clientId,
      algorithms: ['RS256'],
      clockTolerance: 30,
    });
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    const email = payload.email_verified === true && typeof payload.email === 'string' ? payload.email.slice(0, 254) : null;
    const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim().slice(0, 80) : null;
    const picture = typeof payload.picture === 'string' && PICTURE.test(payload.picture) ? payload.picture : null;
    return { sub: payload.sub, email, name, picture };
  } catch {
    // Bad signature, wrong audience, expired, malformed, or Google's keys unreachable.
    return null;
  }
}
