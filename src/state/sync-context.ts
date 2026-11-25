import { createContext, useContext } from 'react';
import type { Account } from '@/sync/sync';

/**
 *  signed-out   — not signed in: modes stay in this browser only
 *  needs-google — holds a cloud copy from before Google sign-in: sign in to keep it
 *  saving       — a save or load is in flight
 *  saved        — signed in, and the cloud copy matches this browser
 *  offline      — signed in, but couldn't reach the site; changes are sent later
 *  error        — the site refused (see `message`)
 */
export type SyncStatus = 'signed-out' | 'needs-google' | 'saving' | 'saved' | 'offline' | 'error';

/**
 * Cloud features are for visitors signed in with Google (the "premium" tier):
 * cloud save across devices, linking devices, the personal MCP server for AI
 * assistants. Everything else works without signing in.
 */
export interface SyncContextValue {
  status: SyncStatus;
  /** A sentence about the last thing that went wrong, worded for a person. */
  message: string | null;
  savedAt: number | null;
  /** Signed in with Google: the account on the profile icon. Null otherwise. */
  account: Account | null;
  /** This browser holds a device key (signed in, or a cloud copy from before Google). */
  hasKey: boolean;
  /** The site's Google Client ID, or null when Google sign-in isn't set up. Fetched once. */
  googleClientId: () => Promise<string | null>;
  /**
   * Handles the ID token from Google's button: signs in, creating the account
   * from this browser's modes the first time. When the account already has
   * modes and this browser has its own, a dialog asks which to keep.
   */
  continueWithGoogle: (credential: string) => Promise<boolean>;
  /** Signs this browser out. Its modes stay here; the cloud copy stays for other devices. */
  signOut: () => Promise<boolean>;
  /** A link that signs another device in to this account; null on failure (see `message`). */
  createLink: () => Promise<string | null>;
  /** Uses a link from another device. This browser's modes are replaced by the account's. */
  adoptLink: (input: string, welcome?: string) => Promise<boolean>;
  /** Every other device and AI assistant loses access; this one keeps it. */
  signOutOtherDevices: () => Promise<boolean>;
  /** Deletes the cloud copy (and the Google link) for good. The modes on this browser stay. */
  deleteCloudCopy: () => Promise<boolean>;
  /**
   * Stops this browser using its cloud copy without touching the copy — used
   * before "Reset everything", so the emptied browser isn't saved over it.
   */
  leaveCloud: () => void;
  /** This tab takes player commands from an assistant (polls; off by default, per tab). */
  remoteControl: boolean;
  setRemoteControl: (on: boolean) => void;
  /** Loads the cloud copy now, unless this browser has changes it hasn't sent. */
  refresh: () => void;
}

export const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside <SyncProvider>.');
  return value;
}
