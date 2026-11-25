import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, type VibeBackup } from '@/state/vibe-context';
import { EMPTY_CUSTOMIZATION } from '@/themes/customize';
import { diffUploads, fingerprint, isEmptyBackup, newSyncKey, parseSyncLink } from './sync';
import { stretchPassword } from './password';

const KEY = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456'; // 43 chars

const backup = (patch: Partial<VibeBackup> = {}): VibeBackup => ({
  app: 'vibe-mode',
  version: 1,
  customization: EMPTY_CUSTOMIZATION,
  preferences: { ...DEFAULT_PREFERENCES },
  customPlaylists: {},
  playlistOverrides: {},
  uploads: {},
  ...patch,
});

describe('sync links', () => {
  it('reads the key from a link or a bare code, and nothing else', () => {
    expect(parseSyncLink(`https://vibe-mode.pages.dev/#sync=${KEY}`)).toBe(KEY);
    expect(parseSyncLink(`  ${KEY}  `)).toBe(KEY);
    expect(parseSyncLink(`https://vibe-mode.pages.dev/?sync=${KEY}`)).toBeNull(); // query, not fragment
    expect(parseSyncLink(`#sync=${KEY}x`)).toBeNull();
    expect(parseSyncLink('#sync=short')).toBeNull();
    expect(parseSyncLink('')).toBeNull();
  });

  it('makes keys the server accepts', () => {
    const key = newSyncKey();
    expect(parseSyncLink(key)).toBe(key);
    expect(newSyncKey()).not.toBe(key);
  });
});

describe('what is worth saving', () => {
  it('saves nothing for a visitor who changed nothing', () => {
    expect(isEmptyBackup(backup())).toBe(true);
    expect(isEmptyBackup(backup({ customPlaylists: { metro: [] } }))).toBe(true);
  });

  it('notices any real change', () => {
    expect(isEmptyBackup(backup({ preferences: { ...DEFAULT_PREFERENCES, motion: false } }))).toBe(false);
    expect(isEmptyBackup(backup({ customization: { ...EMPTY_CUSTOMIZATION, order: ['metro'] } }))).toBe(false);
    expect(isEmptyBackup(backup({ uploads: { metro: 'data:image/webp;base64,AA' } }))).toBe(false);
  });
});

describe('which pictures to send', () => {
  it('sends new and changed pictures, deletes removed ones, skips unchanged ones', () => {
    const a = 'data:image/webp;base64,AAAA';
    const b = 'data:image/webp;base64,BBBB';
    const saved = { metro: fingerprint(a), office: fingerprint(a), college: fingerprint(a) };
    expect(diffUploads({ metro: a, office: b, cab: a }, saved)).toEqual({
      put: ['office', 'cab'],
      remove: ['college'],
    });
  });

  it('tells apart texts of the same length', () => {
    expect(fingerprint('abcd')).not.toBe(fingerprint('abce'));
  });
});

describe('stretchPassword', () => {
  it('is stable, ignores username case and spaces, and depends on both inputs', async () => {
    const proof = await stretchPassword('asha', 'long enough pw');
    expect(proof).toMatch(/^[A-Za-z0-9_-]{43}$/); // the shape the server accepts
    expect(await stretchPassword(' ASHA ', 'long enough pw')).toBe(proof);
    expect(await stretchPassword('ravi', 'long enough pw')).not.toBe(proof);
    expect(await stretchPassword('asha', 'long enough PW')).not.toBe(proof);
  });
});
