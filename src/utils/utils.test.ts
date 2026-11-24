// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { clamp, formatTime, tidyTrackTitle } from './format';
import { STORAGE_KEYS, clearStoredPreferences, readStorage, writeStorage } from './storage';
import { buildShareUrl, readUrlState, syncUrlState } from './url';
import { storedBackup } from './backup';

describe('formatTime and clamp', () => {
  it('formats seconds the way a player shows them', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(-1)).toBe('0:00');
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  });

  it('clamps', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
  });
});

describe('tidyTrackTitle', () => {
  it('drops uploader garnish and emoji, keeps the song', () => {
    expect(tidyTrackTitle('Kesariya (Official Video) | Brahmastra')).toBe('Kesariya | Brahmastra');
    expect(tidyTrackTitle('Tera Ban Jaunga | Full Video HD')).toBe('Tera Ban Jaunga');
    expect(tidyTrackTitle('Tum Hi Ho [Lyrics]')).toBe('Tum Hi Ho');
    expect(tidyTrackTitle('Chill 🎧🔥 beats  (Audio)')).toBe('Chill beats');
    expect(tidyTrackTitle('👨‍👩‍👧 family song')).toBe('family song');
  });

  it('never returns an empty title', () => {
    expect(tidyTrackTitle('(Official Video)')).toBe('(Official Video)');
    expect(tidyTrackTitle('🎧')).toBe('🎧');
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips, and falls back on missing, corrupt or wrongly shaped values', () => {
    writeStorage('a', { x: 1 });
    expect(readStorage('a', {})).toEqual({ x: 1 });
    expect(readStorage('missing', 7)).toBe(7);
    localStorage.setItem('bad', '{not json');
    expect(readStorage('bad', [])).toEqual([]);
    localStorage.setItem('null', 'null');
    expect(readStorage('null', { y: 2 })).toEqual({ y: 2 });
    localStorage.setItem('arr', '[1]');
    expect(readStorage('arr', {})).toEqual({});
  });

  it('"start over" clears only this site’s keys', () => {
    writeStorage(STORAGE_KEYS.customization, { edits: {} });
    localStorage.setItem('someone-else', 'keep');
    clearStoredPreferences();
    expect(localStorage.getItem(STORAGE_KEYS.customization)).toBeNull();
    expect(localStorage.getItem('someone-else')).toBe('keep');
  });

  it('the crash screen’s backup has the shape "Restore from file" takes', () => {
    expect(storedBackup()).toMatchObject({
      app: 'vibe-mode',
      version: 1,
      customization: { edits: {}, added: [], order: [] },
    });
  });
});

describe('the address bar', () => {
  beforeEach(() => history.replaceState(null, '', '/'));

  it('reads and writes ?mode= and ?playlist= without adding history entries', () => {
    history.replaceState(null, '', '/?mode=metro&playlist=metro-vibes&utm=x');
    expect(readUrlState()).toEqual({ mode: 'metro', playlist: 'metro-vibes' });
    const before = history.length;
    syncUrlState({ mode: 'office', playlist: null });
    expect(location.search).toBe('?mode=office&utm=x');
    expect(history.length).toBe(before);
  });

  it('builds a clean share link', () => {
    history.replaceState(null, '', '/?utm=tracking#sync=secret');
    const link = new URL(buildShareUrl({ mode: 'metro', playlist: 'metro-vibes' }));
    expect(link.search).toBe('?mode=metro&playlist=metro-vibes');
    expect(link.hash).toBe(''); // a sync key must never ride along in a share link
  });
});
