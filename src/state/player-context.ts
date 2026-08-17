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
  /**
   * Every video id in the loaded playlist, in play order. Empty until the
   * player has cued the list. Only ids — YouTube gives us a title for the
   * *current* track and nothing else, so the tracklist fetches the rest.
   */
  trackIds: string[];

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
  /** Jump straight to a position in the loaded playlist. */
  playTrackAt: (index: number) => void;
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
