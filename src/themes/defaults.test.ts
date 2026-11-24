import { describe, expect, it } from 'vitest';
import { THEMES } from '@/themes';
import { EMPTY_CUSTOMIZATION, buildThemes } from '@/themes/customize';
import { EMPTY_DEFAULTS, sanitizeDefaults, withDefaults } from '@/themes/defaults';
import { backgroundFor, backgroundStillFor } from '@/themes/backgrounds';
import { resolvePlaylistSource } from '@/music/resolve';

const PL = 'PL1234567890abcdef';

describe('site defaults from /api/config', () => {
  it('keeps only sources the player can load and pictures safe for an src', () => {
    expect(
      sanitizeDefaults({
        playlists: { 'metro-vibes': `https://www.youtube.com/playlist?list=${PL}`, 'metro-rush': '<script>' },
        images: { metro: '/backgrounds/metro.avif', office: 'javascript:alert(1)', 'BAD ID': '/x.avif' },
        posters: { metro: 'data:image/svg+xml,<svg onload=alert(1)>' },
      }),
    ).toEqual({
      playlists: { 'metro-vibes': PL },
      images: { metro: '/backgrounds/metro.avif' },
      posters: {},
    });
  });

  it('turns anything that is not the expected shape into empty defaults', () => {
    // The SPA fallback answers unknown paths with HTML; a parsed string must not crash.
    expect(sanitizeDefaults('<!doctype html>')).toEqual(EMPTY_DEFAULTS);
    expect(sanitizeDefaults({ playlists: 'x', images: [] })).toEqual(EMPTY_DEFAULTS);
  });

  it('fills in playlists and pictures, and an added mode borrows its base’s', () => {
    const defaults = sanitizeDefaults({
      playlists: { 'metro-vibes': PL },
      images: { metro: '/backgrounds/bg.mp4' },
      posters: { metro: '/backgrounds/metro.avif' },
    });
    const themes = buildThemes(withDefaults(THEMES, defaults), {
      ...EMPTY_CUSTOMIZATION,
      added: [{ id: 'my-abcd1234', baseId: 'metro' }],
    });

    for (const id of ['metro', 'my-abcd1234']) {
      const mode = themes.find((theme) => theme.id === id)!;
      const vibes = mode.playlists.find((playlist) => playlist.id === 'metro-vibes');
      expect(resolvePlaylistSource(vibes)).toEqual({ kind: 'playlist', playlistId: PL });
      expect(backgroundFor(mode)).toEqual({ url: '/backgrounds/bg.mp4', kind: 'video' });
      expect(backgroundStillFor(mode)).toBe('/backgrounds/metro.avif');
    }
  });

  it('lets the listener’s own picture and link win over the defaults', () => {
    const defaults = sanitizeDefaults({
      playlists: { 'metro-vibes': PL },
      images: { metro: '/backgrounds/metro.avif' },
    });
    const own = 'PLabcdefabcdef1234';
    const [metro] = buildThemes(withDefaults(THEMES, defaults), {
      ...EMPTY_CUSTOMIZATION,
      edits: { metro: { image: null, playlistSources: { 'metro-vibes': own } } },
    }).filter((theme) => theme.id === 'metro');

    expect(backgroundFor(metro)).toBeNull();
    expect(resolvePlaylistSource(metro.playlists[0])).toEqual({ kind: 'playlist', playlistId: own });
  });
});
