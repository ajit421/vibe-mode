import { createContext, useContext } from 'react';
import type { VibePlaylist } from '@/types/theme';

export type PlayerStatus =
  /** No playlist ID configured for this mode yet. */
  | 'unconfigured'
  /** Fetching the IFrame API or loading a playlist. */
  | 'loading'
  | 'ready'
  /** Something went wrong; `errorMessage` explains it in plain language. */
  | 'error';

export interface PlayerTrack {
  videoId: string;
  title: string;
  author: string;
  url: string;
}

export interface PlayerContextValue {
  status: PlayerStatus;
  errorMessage: string | null;

  playlist: VibePlaylist | undefined;
  track: PlayerTrack | null;
  trackIndex: number;
  trackCount: number;

  isPlaying: boolean;
  isBuffering: boolean;
  /** True until the first successful play — drives "press play to start". */
  needsInteraction: boolean;

  progress: number;
  duration: number;

  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: boolean;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  retry: () => void;

  /** The player bar hands us the element the YouTube iframe lives in. */
  registerHost: (element: HTMLDivElement | null) => void;
}

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer must be used inside <PlayerProvider>.');
  return value;
}
