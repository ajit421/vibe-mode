import { describe, expect, it } from 'vitest';
import { THEMES, suggestedThemeId } from '@/themes';
import {
  EMPTY_CUSTOMIZATION,
  MODE_ICONS,
  TEXT_LIMITS,
  UPLOAD_BUDGET,
  UPLOADED,
  buildThemes,
  carryUpload,
  findIn,
  isDeleted,
  sanitizeCustomization,
  sanitizeUploads,
} from '@/themes/customize';
import { normaliseSource, resolvePlaylistSource, sourceFields } from '@/music/resolve';

/*
 * The sanitiser is the only thing between a hand-edited localStorage entry or
 * a file someone sent you and the app's CSS variables, `src` attributes and
 * player. These pin down what it must refuse, so a later change can't quietly
 * start letting it through.
 */

const ids = new Set(THEMES.map((theme) => theme.id));
const PL = 'PL1234567890abcdef';
const VIDEO = 'dQw4w9WgXcQ';
const byId = (list: ReturnType<typeof buildThemes>, id: string) => list.find((t) => t.id === id)!;

describe('sanitizeCustomization', () => {
  it('returns an empty customisation for anything that is not an object', () => {
    for (const bad of [null, [], 'x', 5, undefined]) {
      expect(sanitizeCustomization(bad, ids)).toEqual(EMPTY_CUSTOMIZATION);
    }
  });

  it('only lets #rrggbb colours through to CSS variables', () => {
    const c = sanitizeCustomization(
      {
        edits: {
          metro: {
            colors: { primary: '#ABCDEF', accent: 'red;}body{display:none', text: 'url(https://evil)' },
          },
        },
      },
      ids,
    );
    expect(c.edits.metro.colors).toEqual({ primary: '#abcdef' });
  });

  it('refuses script and SVG pictures, keeps https links, uploads and "no picture"', () => {
    const c = sanitizeCustomization(
      {
        edits: {
          metro: { image: 'javascript:alert(1)' },
          office: { image: 'data:image/svg+xml;base64,PHN2Zz4=' },
          college: { image: 'https://example.com/x.avif' },
          'cab-wala': { image: null },
          'radio-wala': { image: UPLOADED },
        },
      },
      ids,
    );
    expect(c.edits.metro.image).toBeUndefined();
    expect(c.edits.office.image).toBeUndefined();
    expect(c.edits.college.image).toBe('https://example.com/x.avif');
    expect(c.edits['cab-wala'].image).toBeNull();
    expect(c.edits['radio-wala'].image).toBe(UPLOADED);
  });

  it('drops unknown or colliding mode ids, and bad order entries', () => {
    const c = sanitizeCustomization(
      {
        added: [
          { id: 'my-abcd1234', baseId: 'metro' },
          { id: 'metro', baseId: 'metro' },
          { id: 'my-zzzz9999', baseId: 'nope' },
          { id: 'my-abcd1234', baseId: 'office' },
        ],
        edits: { 'not-a-mode': { name: 'ghost' }, 'my-abcd1234': { name: 'Mine' } },
        order: ['office', 'ghost', 'office', 42, 'my-abcd1234'],
      },
      ids,
    );
    expect(c.added).toEqual([{ id: 'my-abcd1234', baseId: 'metro' }]);
    expect(Object.keys(c.edits)).toEqual(['my-abcd1234']);
    expect(c.order).toEqual(['office', 'my-abcd1234']);
  });

  it('rejects prototype-key icons and fonts, and only keeps deleted/hidden when true', () => {
    const c = sanitizeCustomization(
      { edits: { metro: { icon: 'toString', headingFont: 'constructor', deleted: 'yes', hidden: 1 } } },
      ids,
    );
    expect(c.edits.metro).toEqual({});
  });

  it('clips text and normalises playlist links the same way the editor does', () => {
    const c = sanitizeCustomization(
      {
        edits: {
          metro: {
            name: 'x'.repeat(500),
            playlistSources: {
              'metro-vibes': `https://www.youtube.com/playlist?list=${PL}`,
              'metro-rush': 'javascript:alert(1)',
            },
            removedPlaylists: ['metro-rush', '<x>', 5],
          },
        },
      },
      ids,
    );
    expect(c.edits.metro.name).toHaveLength(TEXT_LIMITS.name);
    expect(c.edits.metro.playlistSources).toEqual({ 'metro-vibes': PL });
    expect(c.edits.metro.removedPlaylists).toEqual(['metro-rush']);
  });
});

describe('sanitizeUploads', () => {
  it('keeps raster data URLs under safe ids only', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(
      sanitizeUploads({
        metro: png,
        office: 'https://example.com/x.png',
        college: 'data:image/svg+xml;base64,PHN2Zz4=',
        '<x>': png,
      }),
    ).toEqual({ metro: png });
  });
});

describe('buildThemes', () => {
  it('applies order, renames, emptied lists and the upload marker', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const list = buildThemes(
      THEMES,
      {
        added: [{ id: 'my-abcd1234', baseId: 'metro' }],
        edits: {
          metro: { name: 'Delhi Metro', quotes: [], image: UPLOADED, stats: ['crowd: Packed', 'no colon'] },
          office: { icon: 'music', deleted: true },
          'my-abcd1234': { name: 'Mine' },
        },
        order: ['office', 'my-abcd1234'],
      },
      { metro: png },
    );
    const metro = byId(list, 'metro');
    const shipped = THEMES.find((t) => t.id === 'metro')!;

    expect(list.slice(0, 2).map((t) => t.id)).toEqual(['office', 'my-abcd1234']);
    expect(metro.name).toBe('Delhi Metro');
    expect(metro.seo).toBeUndefined();
    expect(metro.quotes).toEqual([]);
    expect(metro.customImage).toBe(png);
    // A stat keeps its meter when its label still matches a shipped one.
    expect(metro.stats).toEqual([
      { label: 'crowd', value: 'Packed', meter: shipped.stats!.find((s) => s.label === 'CROWD')!.meter },
    ]);
    expect(byId(list, 'office').icon).toBe(MODE_ICONS.music);
    expect(byId(list, 'my-abcd1234')).toMatchObject({ name: 'Mine', baseId: 'metro', aliases: undefined });
  });

  it('falls back to the default picture when the uploaded one is missing', () => {
    const list = buildThemes(THEMES, { added: [], order: [], edits: { metro: { image: UPLOADED } } });
    expect(byId(list, 'metro').customImage).toBeUndefined();
  });

  it('keeps the name when it is emptied, so no screen is ever untitled', () => {
    const list = buildThemes(THEMES, { added: [], order: [], edits: { metro: { name: '   ' } } });
    expect(byId(list, 'metro').name).toBe('Metro Mode');
  });

  it('still resolves aliases, case-insensitively', () => {
    const list = buildThemes(THEMES, EMPTY_CUSTOMIZATION);
    expect(findIn(list, 'SUBWAY')?.id).toBe('metro');
    expect(isDeleted({ added: [], order: [], edits: { office: { deleted: true } } }, 'office')).toBe(true);
  });
});

describe('playlist links', () => {
  it('reads one video as videos, not as a broken playlist id', () => {
    expect(sourceFields(VIDEO)).toEqual({ youtubePlaylistId: undefined, videoIds: [VIDEO] });
    expect(resolvePlaylistSource({ id: 'x', name: 'x', description: '', ...sourceFields(VIDEO) })).toEqual({
      kind: 'videos',
      videoIds: [VIDEO],
    });
  });

  it('accepts playlist links, video links and comma lists, and nothing else', () => {
    expect(normaliseSource(`https://www.youtube.com/playlist?list=${PL}`)).toBe(PL);
    expect(normaliseSource(`https://youtu.be/${VIDEO}, ${VIDEO}`)).toBe(`${VIDEO},${VIDEO}`);
    expect(normaliseSource('not a link at all')).toBeNull();
    expect(normaliseSource('')).toBeNull();
  });
});

describe('suggestedThemeId', () => {
  it('picks a real mode for every hour of the day', () => {
    for (let hour = 0; hour < 24; hour += 1) expect(ids.has(suggestedThemeId(hour))).toBe(true);
    expect(suggestedThemeId(2)).toBe('judaad-house');
    expect(suggestedThemeId(14)).toBe('office');
  });
});

describe('a new mode carrying an uploaded picture', () => {
  const still = 'data:image/webp;base64,AAAA';

  it('brings the still along when it fits', () => {
    expect(carryUpload({ name: 'Copy', image: UPLOADED }, still, {}, 'my-new1')).toEqual({
      edit: { name: 'Copy', image: UPLOADED },
      still,
    });
  });

  it('falls back to the default picture when storage has no room', () => {
    // Saving it anyway would be dropped by the browser and vanish on reload.
    const full = { 'my-other': 'x'.repeat(UPLOAD_BUDGET) };
    expect(carryUpload({ image: UPLOADED }, still, full, 'my-new1')).toEqual({
      edit: { image: undefined },
    });
  });

  it('never points at an upload that is not there', () => {
    expect(carryUpload({ image: UPLOADED }, undefined, {}, 'my-new1').edit.image).toBeUndefined();
  });

  it('leaves a linked picture alone', () => {
    expect(carryUpload({ image: '/backgrounds/metro.avif' }, still, {}, 'my-new1')).toEqual({
      edit: { image: '/backgrounds/metro.avif' },
    });
  });
});
