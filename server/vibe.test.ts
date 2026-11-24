import { describe, expect, it } from 'vitest';
import { sanitizeCustomization } from '../src/themes/customize';
import {
  BUILT_IN_MODES,
  ToolError,
  addMode,
  addPlaylist,
  asVibeData,
  overview,
  removeMode,
  restoreMode,
  updateMode,
  updatePlaylist,
} from './vibe';

const PL = 'PL1234567890abcdef';
const fresh = () => asVibeData(undefined);

describe('what an assistant can change, checked like the Customize panel', () => {
  it('knows the built-in modes and their playlists', () => {
    expect(BUILT_IN_MODES).toContain('metro');
    const metro = overview(fresh()).modes.find((mode) => mode.id === 'metro')!;
    expect(metro).toMatchObject({ builtIn: true, hidden: false, picture: 'default' });
    expect(metro.playlists.map((p) => p.id)).toContain('metro-vibes');
  });

  it('edits a mode, and the browser’s own sanitiser keeps every field', () => {
    const data = fresh();
    updateMode(data, 'metro', {
      name: 'Late Metro',
      statusLine: 'LAST TRAIN',
      quotes: ['One', 'Two'],
      colors: { primary: '#FF0000' },
      picture: 'https://example.com/a.avif',
    });
    const kept = sanitizeCustomization(data.customization, new Set(BUILT_IN_MODES)).edits.metro;
    expect(kept).toMatchObject({
      name: 'Late Metro',
      kicker: 'LAST TRAIN',
      quotes: ['One', 'Two'],
      colors: { primary: '#ff0000' },
      image: 'https://example.com/a.avif',
    });
  });

  it('refuses what the site would refuse, with a reason', () => {
    const data = fresh();
    expect(() => updateMode(data, 'nowhere', {})).toThrow(/no mode "nowhere"/);
    expect(() => updateMode(data, 'metro', { name: 'x'.repeat(41) })).toThrow(ToolError);
    expect(() => updateMode(data, 'metro', { colors: { primary: 'red' } })).toThrow(/#rrggbb/);
    expect(() => updateMode(data, 'metro', { picture: 'javascript:alert(1)' })).toThrow(/https/);
    expect(() => addPlaylist(data, 'metro', 'x', 'not a link')).toThrow(/YouTube/);
  });

  it('copies a mode under a new id the browser accepts, with its own playlists', () => {
    const data = fresh();
    addPlaylist(data, 'metro', 'Mine', PL);
    const id = addMode(data, 'metro', 'Copy');
    const kept = sanitizeCustomization(data.customization, new Set(BUILT_IN_MODES));
    expect(kept.added).toEqual([{ id, baseId: 'metro' }]);
    expect(kept.edits[id].name).toBe('Copy');
    expect(data.customPlaylists[id][0].name).toBe('Mine');
    expect(data.customPlaylists[id][0].id).not.toBe(data.customPlaylists.metro[0].id);
    // A copy of a copy still points at the built-in mode.
    const second = addMode(data, id);
    expect(data.customization.added.at(-1)).toEqual({ id: second, baseId: 'metro' });
  });

  it('bins built-in modes, deletes added ones, and never empties the picker', () => {
    const data = fresh();
    expect(removeMode(data, 'metro')).toBe('binned');
    restoreMode(data, 'metro');
    expect(data.customization.edits.metro.deleted).toBeUndefined();
    const id = addMode(data, 'metro');
    expect(removeMode(data, id)).toBe('removed');
    expect(data.customization.added).toEqual([]);

    for (const mode of BUILT_IN_MODES.slice(1)) updateMode(data, mode, { hidden: true });
    expect(() => updateMode(data, BUILT_IN_MODES[0], { hidden: true })).toThrow(/last visible/);
    expect(() => removeMode(data, BUILT_IN_MODES[0])).toThrow(/last visible/);
  });

  it('relinks, renames and removes built-in and own playlists', () => {
    const data = fresh();
    updatePlaylist(data, 'metro', 'metro-vibes', { name: 'Tunnel', link: `https://www.youtube.com/playlist?list=${PL}` });
    expect(data.customization.edits.metro).toMatchObject({
      playlistNames: { 'metro-vibes': 'Tunnel' },
      playlistSources: { 'metro-vibes': PL },
    });
    updatePlaylist(data, 'metro', 'metro-vibes', { link: '' });
    expect(data.customization.edits.metro.playlistSources).toEqual({});
    updatePlaylist(data, 'metro', 'metro-rush', { remove: true });
    expect(data.customization.edits.metro.removedPlaylists).toEqual(['metro-rush']);

    const own = addPlaylist(data, 'metro', 'Mine', PL);
    updatePlaylist(data, 'metro', own, { remove: true });
    expect(data.customPlaylists.metro).toEqual([]);
    expect(() => updatePlaylist(data, 'metro', 'nope', {})).toThrow(/no playlist/);
  });
});
