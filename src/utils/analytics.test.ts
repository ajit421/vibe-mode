// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { report, setPlaying, setVisible, snapshot, track } from './analytics';

/*
 * The client half of the admin page's analytics. Module state (the visit's
 * timers and counts) is shared, so the tests read differences, not absolutes.
 */

const beacon = vi.fn<(url: string, body: Blob) => boolean>();

beforeEach(() => {
  vi.stubEnv('PROD', true); // counting is off in development
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  beacon.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

const sent = async (call: number) => JSON.parse(await (beacon.mock.calls[call][1] as Blob).text());

describe('analytics', () => {
  it('adds up time on screen and time listening, and a report carries the totals', () => {
    const start = snapshot(1_000_000);
    setVisible(false, 1_000_000);
    setVisible(true, 1_010_000); // 10 s hidden
    setPlaying(true, 1_010_000);
    setPlaying(false, 1_040_000); // 30 s of music
    setVisible(false, 1_050_000);
    const end = snapshot(1_050_000);
    expect(end.visibleMs - start.visibleMs).toBe(40_000); // 50 s, minus the 10 s hidden
    expect(end.listenedMs - start.listenedMs).toBe(30_000);
    expect(end.openMs - start.openMs).toBe(50_000);
    expect(end.tab).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('counts uses, sends them once, and keeps them when the report could not go out', async () => {
    track('panel', 'Customize');
    track('panel', 'Customize');
    track('Not A Name');
    beacon.mockReturnValueOnce(false);
    report();
    expect((await sent(0)).events).toEqual([{ name: 'panel', detail: 'Customize', n: 2 }]);

    beacon.mockReturnValueOnce(true);
    report(); // not queued last time, so still here
    expect((await sent(1)).events).toEqual([{ name: 'panel', detail: 'Customize', n: 2 }]);

    beacon.mockReturnValueOnce(true);
    report(); // sent: gone
    expect((await sent(2)).events).toEqual([]);
  });

  it('counts nothing and sends nothing in development', () => {
    vi.stubEnv('PROD', false);
    track('panel', 'Settings');
    report();
    expect(beacon).not.toHaveBeenCalled();
    vi.stubEnv('PROD', true);
    expect(snapshot().events).toEqual([]);
  });
});
