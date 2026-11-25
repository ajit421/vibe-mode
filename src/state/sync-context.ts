import { createContext, useContext } from 'react';

/**
 *  idle    — nothing saved to the cloud yet (nothing changed, or never)
 *  saving  — a save or load is in flight
 *  saved   — the cloud copy matches this browser
 *  offline — couldn't reach the site; changes are kept here and sent later
 *  error   — the site refused (see `message`)
 *  off     — the visitor deleted their cloud copy; nothing is sent
 */
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'off';

export interface SyncContextValue {
  status: SyncStatus;
  /** A sentence about the last thing that went wrong, worded for a person. */
  message: string | null;
  savedAt: number | null;
  /** This browser has a cloud copy (a device key). */
  hasKey: boolean;
  passkeysSupported: boolean;
  /** A link that brings these modes to another device; null on failure (see `message`). */
  createLink: () => Promise<string | null>;
  /** Uses a link or code from another device. This browser's modes are replaced by those. */
  adoptLink: (input: string, welcome?: string) => Promise<boolean>;
  /** Every other device loses access; this one keeps it. Revokes a leaked link. */
  signOutOtherDevices: () => Promise<boolean>;
  /** Deletes the cloud copy for good and stops saving. The modes on this browser stay. */
  deleteCloudCopy: () => Promise<boolean>;
  /** Starts saving to the cloud again after `deleteCloudCopy`. */
  turnOn: () => void;
  /** An MCP server URL for an AI assistant, carrying a fresh device key; null on failure. */
  connectAssistant: () => Promise<string | null>;
  /** This tab takes player commands from an assistant (polls; off by default, per tab). */
  remoteControl: boolean;
  setRemoteControl: (on: boolean) => void;
  /** Loads the cloud copy now, unless this browser has changes it hasn't sent. */
  refresh: () => void;
  addPasskey: () => Promise<boolean>;
  /** Signs in with a passkey. This browser's modes are replaced by that profile's. */
  signInWithPasskey: () => Promise<boolean>;
  /** This profile's sign-in username; null when none is set or there is no cloud copy. */
  loginName: () => Promise<string | null>;
  /** Sets or changes the username and password (saving first if needed). A change signs other devices out. */
  setPassword: (username: string, password: string) => Promise<boolean>;
  removePassword: () => Promise<boolean>;
  /** Signs in with a username and password. This browser's modes are replaced by that profile's. */
  signInWithPassword: (username: string, password: string) => Promise<boolean>;
}

export const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside <SyncProvider>.');
  return value;
}
