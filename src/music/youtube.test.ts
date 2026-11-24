// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableJavaScriptFileLoading":true,"handleDisabledFileLoadingAsSuccess":true}}
import { afterEach, describe, expect, it } from 'vitest';
import { YT_ERROR, describeYouTubeError, loadYouTubeIframeApi, type YTNamespace } from './youtube';

// Script loading is off, so nothing is fetched; a network failure is
// simulated by firing the tag's error handler, as a browser would.
const tag = () => document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
const failLoad = () => tag()?.onerror?.(new Event('error'));

afterEach(() => {
  delete window.YT;
  document.head.innerHTML = '';
});

describe('loading the YouTube player', () => {
  it('a failed load leaves no dead <script>, so "Try again" fetches it afresh', async () => {
    const first = loadYouTubeIframeApi();
    expect(tag()).not.toBeNull();
    failLoad();
    await expect(first).rejects.toThrow('Could not reach YouTube.');
    expect(tag()).toBeNull();

    // The retry makes a new request instead of waiting on the failed one.
    const retry = loadYouTubeIframeApi();
    expect(tag()).not.toBeNull();
    failLoad();
    await expect(retry).rejects.toThrow('Could not reach YouTube.');
  });

  it('resolves when YouTube says it is ready, and shares one load between callers', async () => {
    const a = loadYouTubeIframeApi();
    const b = loadYouTubeIframeApi();
    expect(a).toBe(b);
    const api = { Player: function Player() {} } as unknown as YTNamespace;
    window.YT = api;
    window.onYouTubeIframeAPIReady?.();
    await expect(a).resolves.toBe(api);
  });
});

describe('player errors', () => {
  it('are worded for a person, with a fallback for unknown codes', () => {
    expect(describeYouTubeError(YT_ERROR.NOT_EMBEDDABLE)).toMatch(/disabled embedding/);
    expect(describeYouTubeError(YT_ERROR.NOT_FOUND)).toMatch(/private, deleted or region-locked/);
    expect(describeYouTubeError(9999)).toMatch(/chai break/);
  });
});
