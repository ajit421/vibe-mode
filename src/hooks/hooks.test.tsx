// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@/test/render';
import { useLocalStorage } from './useLocalStorage';
import { useMediaQuery } from './useMediaQuery';
import { useNetworkStatus } from './useNetworkStatus';
import { usePageHidden } from './usePageVisibility';
import { useRotator } from './useRotator';
import { useClock } from './useClock';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('useLocalStorage', () => {
  it('starts from storage, and writes changes back', () => {
    localStorage.setItem('k', JSON.stringify({ a: 1 }));
    const { result } = renderHook(() => useLocalStorage('k', { a: 0 }));
    expect(result.current[0]).toEqual({ a: 1 });
    act(() => result.current[1]({ a: 2 }));
    expect(JSON.parse(localStorage.getItem('k')!)).toEqual({ a: 2 });
  });

  it('ignores a stored value of the wrong shape instead of crashing on it', () => {
    localStorage.setItem('k', '"a string, not a list"');
    const { result } = renderHook(() => useLocalStorage<string[]>('k', []));
    expect(result.current[0]).toEqual([]);
  });

  it('lets `reconcile` overrule storage on first load (a ?mode= link)', () => {
    localStorage.setItem('k', '"metro"');
    const { result } = renderHook(() => useLocalStorage('k', 'office', () => 'college'));
    expect(result.current[0]).toBe('college');
  });

  it('picks up another tab’s write only when syncing is on', () => {
    const synced = renderHook(() => useLocalStorage('k', 1, undefined, true));
    const local = renderHook(() => useLocalStorage('k', 1));
    localStorage.setItem('k', '5');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'k', storageArea: localStorage }));
    });
    expect(synced.result.current[0]).toBe(5);
    expect(local.result.current[0]).toBe(1);
  });

  it('does not write a value from another tab back, even reshaped by the check', () => {
    // The check rebuilds the object with its keys in another order — as the
    // customisation sanitiser does. Writing that back fired a storage event in
    // the tab it came from, one write behind, and undid that tab's typing.
    const reorder = (value: { a: number; b: number }) => ({ b: value.b, a: value.a });
    const synced = renderHook(() => useLocalStorage('k2', { a: 0, b: 0 }, reorder, true));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    localStorage.setItem('k2', JSON.stringify({ a: 1, b: 2 }));
    write.mockClear();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'k2', storageArea: localStorage }));
    });
    expect(synced.result.current[0]).toEqual({ a: 1, b: 2 });
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem('k2')).toBe('{"a":1,"b":2}');
    write.mockRestore();
  });
});

describe('useMediaQuery', () => {
  it('follows the media query as it changes', () => {
    let listener: ((event: { matches: boolean }) => void) | undefined;
    const list = {
      matches: false,
      addEventListener: (_: string, fn: typeof listener) => (listener = fn),
      removeEventListener: () => {},
    };
    vi.spyOn(window, 'matchMedia').mockReturnValue(list as unknown as MediaQueryList);
    const { result } = renderHook(() => useMediaQuery('(prefers-reduced-motion: reduce)'));
    expect(result.current).toBe(false);
    act(() => listener?.({ matches: true }));
    expect(result.current).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('useNetworkStatus and usePageHidden', () => {
  it('follow online/offline events', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('follow the tab being hidden and shown', () => {
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { result } = renderHook(() => usePageHidden());
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(true);
    state.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(false);
    state.mockRestore();
  });
});

describe('useRotator', () => {
  it('advances on a timer, wraps round, and holds still while paused', () => {
    vi.useFakeTimers();
    const items = ['a', 'b', 'c'];
    let paused = false;
    const { result, rerender } = renderHook(() => useRotator(items, { intervalMs: 100, paused }));
    expect(result.current.item).toBe('a');
    act(() => void vi.advanceTimersByTime(100));
    expect(result.current.item).toBe('b');
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current.item).toBe('a');
    paused = true;
    rerender();
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current.item).toBe('a');
  });

  it('copes with an empty list', () => {
    const { result } = renderHook(() => useRotator([] as string[]));
    expect(result.current).toMatchObject({ item: undefined, total: 0 });
    act(() => result.current.next());
    expect(result.current.index).toBe(0);
  });
});

describe('useClock', () => {
  it('ticks', () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T10:00:00') });
    const { result } = renderHook(() => useClock(1000));
    const first = result.current.getTime();
    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current.getTime() - first).toBe(3000);
  });
});

describe('useKeyboardShortcuts', () => {
  const press = (key: string, target: EventTarget = window, init: KeyboardEventInit = {}) =>
    act(() => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
    });

  it('runs the mapped handler, with mod+ for Ctrl/⌘', () => {
    const c = vi.fn();
    const save = vi.fn();
    renderHook(() => useKeyboardShortcuts({ c, 'mod+s': save }));
    press('C');
    press('s', window, { ctrlKey: true });
    expect(c).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('stays out of the way while typing in a field', () => {
    const c = vi.fn();
    renderHook(() => useKeyboardShortcuts({ c }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('c', input);
    expect(c).not.toHaveBeenCalled();
    input.remove();
  });

  it('does nothing when disabled, or with Alt held', () => {
    const c = vi.fn();
    renderHook(() => useKeyboardShortcuts({ c }, false));
    press('c');
    const d = vi.fn();
    renderHook(() => useKeyboardShortcuts({ d }));
    press('d', window, { altKey: true });
    expect(c).not.toHaveBeenCalled();
    expect(d).not.toHaveBeenCalled();
  });
});
