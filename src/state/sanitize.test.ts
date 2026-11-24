import { describe, expect, it } from 'vitest';
import { sanitizeCustomPlaylists, sanitizeOverrides, sanitizePreferences } from './sanitize';
import { DEFAULT_PREFERENCES } from './vibe-context';

const PL = 'PL1234567890abcdef';

describe('stored data the app reads on every load', () => {
  it('drops a non-list playlist entry instead of crashing on it', () => {
    // This exact value crashed the app on every load before it was checked.
    expect(sanitizeCustomPlaylists({ metro: 'x' })).toEqual({});
    expect(
      sanitizeCustomPlaylists({
        metro: [
          { id: 'custom-ok1', name: 'Good', source: `https://www.youtube.com/playlist?list=${PL}` },
          { id: 'custom-bad', name: 'Bad', source: '<script>alert(1)</script>' },
          { id: 'not-custom', name: 'Wrong id', source: PL },
          'junk',
        ],
        '<x>': [{ id: 'custom-ok2', name: 'Bad key', source: PL }],
      }),
    ).toEqual({ metro: [{ id: 'custom-ok1', name: 'Good', source: PL }] });
  });

  it('keeps only real playlist ids from old Settings links', () => {
    expect(sanitizeOverrides({ 'metro-vibes': PL, 'metro-rush': 5, office: 'nope', '<x>': PL })).toEqual({
      'metro-vibes': PL,
    });
  });

  it('fills preferences from the defaults and only accepts booleans', () => {
    expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences({ clock: false, motion: 'yes', evil: true })).toEqual({
      ...DEFAULT_PREFERENCES,
      clock: false,
    });
  });
});
