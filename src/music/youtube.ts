/**
 * A thin, typed wrapper around the official YouTube IFrame Player API.
 *
 * We only ever *embed* the official player — audio is never downloaded,
 * proxied or extracted. The iframe is rendered off-screen and driven by our
 * own UI, which the IFrame API explicitly supports.
 *
 * https://developers.google.com/youtube/iframe_api_reference
 */

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

/** Error codes the IFrame API reports, mapped to human copy in the player. */
export const YT_ERROR = {
  INVALID_PARAM: 2,
  HTML5_ERROR: 5,
  NOT_FOUND: 100,
  NOT_EMBEDDABLE: 101,
  NOT_EMBEDDABLE_ALT: 150,
} as const;

export interface YTVideoData {
  video_id: string;
  title: string;
  author: string;
}

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  nextVideo(): void;
  previousVideo(): void;
  playVideoAt(index: number): void;

  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;

  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  /**
   * 0–1, how much of the current track has been buffered. This is the only
   * reliable way to tell a track that is merely slow from one that is never
   * going to start: a slow track's buffer keeps growing, a blocked one's
   * stays exactly where it is.
   */
  getVideoLoadedFraction(): number;

  getVideoData(): YTVideoData | undefined;
  getVideoUrl(): string;
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;

  loadPlaylist(options: YTPlaylistOptions | string[]): void;
  cuePlaylist(options: YTPlaylistOptions | string[]): void;
  setShuffle(shuffle: boolean): void;
  setLoop(loop: boolean): void;

  destroy(): void;
}

export interface YTPlaylistOptions {
  list?: string;
  listType?: 'playlist' | 'user_uploads';
  playlist?: string[];
  index?: number;
  startSeconds?: number;
}

export interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

export interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    config: {
      host?: string;
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: YTPlayerEvent) => void;
        onStateChange?: (event: YTPlayerEvent) => void;
        onError?: (event: YTPlayerEvent) => void;
        onPlaybackQualityChange?: (event: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: typeof YT_STATE;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = 'https://www.youtube.com/iframe_api';
const LOAD_TIMEOUT_MS = 15_000;

let apiPromise: Promise<YTNamespace> | null = null;

/**
 * Loads the IFrame API exactly once per page. Safe to call from several
 * components; they all await the same promise.
 */
export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('YouTube IFrame API needs a browser environment.'));
      return;
    }

    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const timeout = window.setTimeout(() => {
      // Reset so a later retry (e.g. after the network comes back) can work.
      apiPromise = null;
      reject(new Error('Timed out loading the YouTube player.'));
    }, LOAD_TIMEOUT_MS);

    const finish = () => {
      window.clearTimeout(timeout);
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        apiPromise = null;
        reject(new Error('YouTube player loaded but is unavailable.'));
      }
    };

    // The API calls this global exactly once. Chain onto anything already set
    // rather than clobbering it.
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      finish();
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${API_SRC}"]`);
    if (existing) {
      existing.addEventListener('error', () => {
        window.clearTimeout(timeout);
        apiPromise = null;
        reject(new Error('Could not reach YouTube.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      apiPromise = null;
      reject(new Error('Could not reach YouTube.'));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

/** Friendly, on-brand copy for the error codes the player can emit. */
export function describeYouTubeError(code: number): string {
  switch (code) {
    case YT_ERROR.INVALID_PARAM:
      return 'That playlist link doesn’t look right. Fix it in Customize.';
    case YT_ERROR.HTML5_ERROR:
      return 'The player had trouble with this track. Skipping usually fixes it.';
    case YT_ERROR.NOT_FOUND:
      return 'This playlist or video is gone — private, deleted or region-locked.';
    case YT_ERROR.NOT_EMBEDDABLE:
    case YT_ERROR.NOT_EMBEDDABLE_ALT:
      return 'The owner has disabled embedding for this track. Try the next one.';
    default:
      return 'YouTube is taking a chai break. Try again in a moment.';
  }
}
