import { describe, expect, it } from 'vitest';
import { base64UrlToBytes, bearer, bytesToBase64Url, hashKey, isStill, newKey, overLimit } from './lib';

describe('device keys', () => {
  it('accepts only a well-formed Bearer key', () => {
    const key = newKey();
    const request = (value?: string) =>
      new Request('https://x.test/', value ? { headers: { Authorization: value } } : {});
    expect(bearer(request(`Bearer ${key}`))).toBe(key);
    expect(bearer(request(`Bearer ${key}x`))).toBeNull();
    expect(bearer(request(key))).toBeNull();
    expect(bearer(request())).toBeNull();
  });

  it('stores a stable hash, never the key', async () => {
    const key = newKey();
    const hash = await hashKey(key);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashKey(key)).toBe(hash);
    expect(await hashKey(newKey())).not.toBe(hash);
  });

  it('round-trips base64url', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(33));
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
  });
});

describe('uploaded pictures', () => {
  it('takes raster data URLs only', () => {
    expect(isStill('data:image/webp;base64,AAAA')).toBe(true);
    expect(isStill('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(isStill('https://example.com/a.png')).toBe(false);
    expect(isStill(`data:image/png;base64,${'A'.repeat(1_600_000)}`)).toBe(false);
  });
});

describe('overLimit', () => {
  const from = (ip?: string) => new Request('https://x.test/', ip ? { headers: { 'CF-Connecting-IP': ip } } : {});

  it('allows `max` calls per address in the window, then refuses until it passes', () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i += 1) expect(overLimit(from('203.0.113.1'), 'a', 3, 60_000, t + i)).toBe(false);
    expect(overLimit(from('203.0.113.1'), 'a', 3, 60_000, t + 10)).toBe(true);
    expect(overLimit(from('203.0.113.2'), 'a', 3, 60_000, t + 10)).toBe(false); // another address
    expect(overLimit(from('203.0.113.1'), 'b', 3, 60_000, t + 10)).toBe(false); // another bucket
    expect(overLimit(from('203.0.113.1'), 'a', 3, 60_000, t + 60_000)).toBe(false); // a new window
  });

  it('never limits a request with no address (tests, internal calls)', () => {
    for (let i = 0; i < 10; i += 1) expect(overLimit(from(), 'c', 1, 60_000)).toBe(false);
  });
});
