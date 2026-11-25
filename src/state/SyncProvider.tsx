import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useVibe } from './vibe-context';
import { useToast } from './toast-context';
import { SyncContext, type SyncContextValue, type SyncStatus } from './sync-context';
import { Modal } from '@/components/ui/Modal';
import {
  EMPTY_RECORD,
  SYNC_STORAGE_KEY,
  diffUploads,
  fingerprint,
  isEmptyBackup,
  newSyncKey,
  parseSyncLink,
  readRecord,
  splitBackup,
  syncLink,
  writeRecord,
  type SyncRecord,
} from '@/sync/sync';
import {
  deleteProfile,
  deleteUpload,
  getLogin,
  loadProfile,
  passwordLogin,
  removeLogin,
  setLogin,
  mintKey,
  passkeyOptions,
  passkeyVerify,
  saveProfile,
  saveUpload,
  signOutOthers,
  type ApiResult,
  type Profile,
} from '@/sync/api';
import { turnstileToken } from '@/sync/turnstile';

/** Quiet time after the last change before saving — the Customize panel changes state per keystroke. */
const SAVE_DELAY_MS = 2_000;
const REMOTE_KEY = 'vibe-mode.remoteControl';
/** Coming back to the tab re-checks the cloud copy at most this often. */
const PULL_INTERVAL_MS = 30_000;

/*
 * Keeps the visitor's changes in the cloud (D1) as well as in this browser.
 *
 *  - Saving: any change to what "Download my settings" would contain is sent
 *    two seconds after the last one. Text and pictures go separately, and a
 *    picture only when it changed. Nothing is sent for a visitor who hasn't
 *    changed anything — no key, no database row.
 *  - Loading: on page load and on coming back to the tab, the cloud copy
 *    replaces this browser's — unless this browser has changes it hasn't
 *    sent yet, which then win and are sent.
 *  - What was last saved is fingerprinted in localStorage (`vibe-mode.sync`),
 *    shared by every tab, so one tab's save isn't repeated by the others and
 *    a change made offline is still sent after a reload.
 *
 * shortcut: whole-record last-write-wins between devices; two devices editing
 * within the same few seconds keep only the later save. Per-field merging
 * would be the upgrade if people edit on two devices at once.
 *
 * Loading goes through `importSettings`, the same sanitised path as
 * "Restore from file", so nothing from the server reaches the page unchecked.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { exportSettings, importSettings } = useVibe();
  const { push: toast } = useToast();

  const backup = useMemo(() => exportSettings(), [exportSettings]);
  // What is here now, for the async code below to read at the moment it runs.
  const current = useMemo(() => {
    const { data, uploads } = splitBackup(backup);
    return { data, uploads, dataJson: JSON.stringify(data), empty: isEmptyBackup(backup) };
  }, [backup]);
  const latest = useRef(current);
  latest.current = current;

  const [record, setRecord] = useState<SyncRecord>(readRecord);
  const [status, setStatus] = useState<SyncStatus>(() =>
    record.off ? 'off' : record.key ? 'saved' : 'idle',
  );
  const [message, setMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  /** Writes the record for every tab, and shows it here. */
  const store = useCallback((next: SyncRecord) => {
    writeRecord(next);
    setRecord(next);
  }, []);

  // Another tab saved, signed in or turned sync off.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SYNC_STORAGE_KEY) setRecord(readRecord());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** Nothing is saved or loaded until the first load (or a link decision) is settled. */
  const ready = useRef(false);
  /** The next state change is the cloud copy arriving: record it as saved, don't send it back. */
  const adopting = useRef<number | null>(null);
  const saving = useRef(false);
  const saveAgain = useRef(false);
  const lastPull = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const unsaved = useCallback((rec: SyncRecord) => {
    const { dataJson, uploads } = latest.current;
    const { put, remove } = diffUploads(uploads, rec.uploads);
    return rec.data !== fingerprint(dataJson) || put.length > 0 || remove.length > 0;
  }, []);

  const report = useCallback((result: ApiResult<unknown>) => {
    if (result.ok) return;
    setStatus(result.status === 0 ? 'offline' : 'error');
    setMessage(result.status === 0 ? 'Offline — your changes are kept here and saved when you’re back.' : result.error);
  }, []);

  /** Lays a cloud copy over this browser. */
  const adopt = useCallback(
    (profile: Profile, key: string) => {
      adopting.current = profile.version;
      store({ ...readRecord(), key, off: false, version: profile.version });
      // Forced to a full backup: a stored `kind: 'mode'` must not turn this
      // into "add a shared mode".
      importSettings({ ...(profile.data as object), app: 'vibe-mode', kind: 'backup', uploads: profile.uploads });
      setStatus('saved');
      setMessage(null);
      setSavedAt(profile.version);
    },
    [importSettings, store],
  );

  /** The key is gone on the server (deleted, signed out from another device). */
  const forget = useCallback(() => {
    store({ ...EMPTY_RECORD });
    setStatus('idle');
    setMessage('This browser was signed out of cloud save. Your modes here are untouched.');
  }, [store]);

  const save = useCallback(
    async (force = false): Promise<boolean> => {
      window.clearTimeout(timer.current);
      if (saving.current) {
        saveAgain.current = true;
        return false;
      }
      let rec = readRecord();
      if (rec.off) return false;
      const { data, dataJson, uploads, empty } = latest.current;
      if (!rec.key && empty && !force) return true; // nothing worth a database row
      if (rec.key && !unsaved(rec)) {
        setStatus('saved');
        return true;
      }

      saving.current = true;
      setStatus('saving');
      try {
        // The key is stored before the first request, so a second tab saving
        // at the same moment reuses it instead of making a second profile.
        if (!rec.key) {
          rec = { ...rec, key: newSyncKey() };
          store(rec);
        }
        const key = rec.key as string;

        const dataPrint = fingerprint(dataJson);
        if (rec.data !== dataPrint) {
          let result = await saveProfile(key, data);
          if (!result.ok && result.status === 403 && result.body?.challenge) {
            const siteKey = result.body.siteKey;
            const token = typeof siteKey === 'string' ? await turnstileToken(siteKey) : null;
            if (!token) {
              setStatus('error');
              setMessage('Couldn’t confirm you’re not a robot, so nothing was saved to the cloud.');
              return false;
            }
            result = await saveProfile(key, data, token);
          }
          if (!result.ok && (result.status === 429 || result.status === 409)) {
            saveAgain.current = true; // too soon, or a race — try again shortly
            return false;
          }
          if (!result.ok) {
            report(result);
            return false;
          }
          rec = { ...readRecord(), key, data: dataPrint, version: result.body.version };
          store(rec);
        }

        const { put, remove } = diffUploads(uploads, rec.uploads);
        for (const id of put) {
          const result = await saveUpload(key, id, uploads[id]);
          if (!result.ok) {
            if (result.status === 401) forget();
            else report(result);
            return false;
          }
          rec = { ...readRecord(), uploads: { ...readRecord().uploads, [id]: fingerprint(uploads[id]) } };
          store(rec);
        }
        for (const id of remove) {
          const result = await deleteUpload(key, id);
          if (!result.ok && result.status !== 401) {
            report(result);
            return false;
          }
          const rest = { ...readRecord().uploads };
          delete rest[id];
          rec = { ...readRecord(), uploads: rest };
          store(rec);
        }

        setStatus('saved');
        setMessage(null);
        setSavedAt(Date.now());
        return true;
      } finally {
        saving.current = false;
        if (saveAgain.current) {
          saveAgain.current = false;
          timer.current = window.setTimeout(() => void save(), SAVE_DELAY_MS);
        }
      }
    },
    [unsaved, report, forget, store],
  );

  const pull = useCallback(async () => {
    const rec = readRecord();
    if (!rec.key || rec.off) return;
    lastPull.current = Date.now();
    const result = await loadProfile(rec.key);
    if (result.ok) {
      // Unchanged since this browser last saw it: nothing to lay over.
      if (result.body.version !== rec.version) adopt(result.body, rec.key);
      else setStatus('saved');
    } else if (result.status === 401) {
      forget();
    } else {
      report(result);
    }
  }, [adopt, forget, report]);

  /* ── A sync link opened on this device (`#sync=…`) ─────────────────────── */
  const [incoming, setIncoming] = useState<string | null>(() => parseSyncLink(window.location.hash));

  const adoptLink = useCallback(
    async (input: string): Promise<boolean> => {
      const key = parseSyncLink(input);
      if (!key) {
        setMessage('That isn’t a sync link. Copy the whole link from your other device.');
        return false;
      }
      setStatus('saving');
      const result = await loadProfile(key);
      ready.current = true;
      if (!result.ok) {
        if (result.status === 401) {
          setStatus(readRecord().key ? 'saved' : 'idle');
          setMessage('That link doesn’t work any more. Make a new one on your other device.');
        } else report(result);
        return false;
      }
      adopt(result.body, key);
      toast('Your modes from the other device are here.', 'SYNC');
      return true;
    },
    [adopt, report, toast],
  );

  const start = useCallback(() => {
    const rec = readRecord();
    if (!rec.key || rec.off) {
      ready.current = true;
      void save();
      return;
    }
    // Changes made here and not yet sent (offline, or closed within the
    // two-second wait) win over the cloud copy; otherwise the cloud copy wins.
    if (unsaved(rec)) {
      ready.current = true;
      void save();
    } else {
      void pull().finally(() => {
        ready.current = true;
      });
    }
  }, [pull, save, unsaved]);

  // First load. A sync link is taken out of the address bar at once, so it
  // never lands in history, a bookmark or a screenshot.
  useEffect(() => {
    if (incoming) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      // A browser with nothing of its own just takes it; otherwise ask first.
      if (latest.current.empty && !readRecord().key) {
        setIncoming(null);
        void adoptLink(incoming);
      }
      return;
    }
    start();
    // Runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every change: save after a quiet spell.
  useEffect(() => {
    if (adopting.current !== null) {
      // The cloud copy just arrived: what is here now *is* the saved state.
      const { dataJson, uploads } = latest.current;
      store({
        ...readRecord(),
        data: fingerprint(dataJson),
        uploads: Object.fromEntries(Object.entries(uploads).map(([id, still]) => [id, fingerprint(still)])),
        version: adopting.current,
      });
      adopting.current = null;
      return;
    }
    if (!ready.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), SAVE_DELAY_MS);
  }, [backup, save, store]);

  // Back to the tab, or back online: send what's waiting, or fetch what changed elsewhere.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible' || !ready.current || saving.current) return;
      const rec = readRecord();
      if (!rec.key || rec.off) return;
      if (unsaved(rec)) void save();
      else if (Date.now() - lastPull.current > PULL_INTERVAL_MS) void pull();
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
      window.clearTimeout(timer.current);
    };
  }, [pull, save, unsaved]);

  /* ── Actions for the panel ─────────────────────────────────────────────── */

  /** A fresh device key for this profile — for a sync link or an AI assistant. */
  const mint = useCallback(async (): Promise<string | null> => {
    if (readRecord().off) return null;
    // Linking before changing anything is fine: make the cloud copy now.
    if (!readRecord().key || unsaved(readRecord())) {
      if (!(await save(true))) return null;
    }
    const result = await mintKey(readRecord().key as string);
    if (!result.ok) {
      report(result);
      return null;
    }
    return result.body.key;
  }, [save, unsaved, report]);

  const createLink = useCallback(async () => {
    const key = await mint();
    return key ? syncLink(key) : null;
  }, [mint]);

  const connectAssistant = useCallback(async () => {
    const key = await mint();
    return key ? `${window.location.origin}/mcp/${key}` : null;
  }, [mint]);

  const refresh = useCallback(() => {
    const rec = readRecord();
    if (!ready.current || saving.current || !rec.key || rec.off) return;
    if (unsaved(rec)) void save();
    else void pull();
  }, [pull, save, unsaved]);

  // Per tab on purpose (sessionStorage): letting an assistant drive the player
  // is a decision about this tab, and every listening tab costs requests.
  const [remoteControl, setRemoteState] = useState(() => {
    try {
      return window.sessionStorage.getItem(REMOTE_KEY) === 'on';
    } catch {
      return false;
    }
  });
  const setRemoteControl = useCallback((on: boolean) => {
    setRemoteState(on);
    try {
      if (on) window.sessionStorage.setItem(REMOTE_KEY, 'on');
      else window.sessionStorage.removeItem(REMOTE_KEY);
    } catch {
      /* storage blocked — it just won't survive a reload */
    }
  }, []);

  const signOutOtherDevices = useCallback(async () => {
    const key = readRecord().key;
    if (!key) return false;
    const result = await signOutOthers(key);
    if (!result.ok) {
      report(result);
      return false;
    }
    toast(
      result.body.removed === 1 ? 'Signed out 1 other device.' : `Signed out ${result.body.removed} other devices.`,
      'SYNC',
    );
    return true;
  }, [report, toast]);

  const deleteCloudCopy = useCallback(async () => {
    const key = readRecord().key;
    if (key) {
      const result = await deleteProfile(key);
      if (!result.ok && result.status !== 401) {
        report(result);
        return false;
      }
    }
    store({ ...EMPTY_RECORD, off: true });
    setStatus('off');
    setMessage(null);
    toast('Cloud copy deleted. Your modes are still here in this browser.', 'SYNC');
    return true;
  }, [report, store, toast]);

  const turnOn = useCallback(() => {
    store({ ...EMPTY_RECORD });
    setStatus('idle');
    ready.current = true;
    void save();
  }, [save, store]);

  const addPasskey = useCallback(async () => {
    if (!readRecord().key || unsaved(readRecord())) {
      if (!(await save(true))) return false;
    }
    const key = readRecord().key as string;
    const options = await passkeyOptions('register', key);
    if (!options.ok) {
      report(options);
      return false;
    }
    let response: unknown;
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      response = await startRegistration({ optionsJSON: options.body.options as never });
    } catch {
      setMessage('No passkey was added.');
      return false;
    }
    const result = await passkeyVerify(options.body.challengeId, response, key);
    if (!result.ok) {
      report(result);
      return false;
    }
    toast('Passkey added. Use it to sign in on a new device.', 'SYNC');
    return true;
  }, [save, unsaved, report, toast]);

  const signInWithPasskey = useCallback(async () => {
    const options = await passkeyOptions('login', null);
    if (!options.ok) {
      report(options);
      return false;
    }
    let response: unknown;
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      response = await startAuthentication({ optionsJSON: options.body.options as never });
    } catch {
      setMessage('Sign-in was cancelled.');
      return false;
    }
    const result = await passkeyVerify(options.body.challengeId, response, null);
    if (!result.ok || !result.body.key) {
      report(result);
      return false;
    }
    return adoptLink(result.body.key);
  }, [adoptLink, report]);

  /* ── Username + password (functions/api/login.ts) ──────────────────────── */

  /** A refusal of what was typed (taken name, wrong password) is no failed save: the save status stays. */
  const refuse = useCallback(
    (result: ApiResult<unknown>) => {
      if (result.ok) return;
      if (result.status === 0) report(result);
      else setMessage(result.error);
    },
    [report],
  );

  const loginName = useCallback(async () => {
    const key = readRecord().key;
    if (!key) return null;
    const result = await getLogin(key);
    return result.ok ? result.body.username : null;
  }, []);

  const setPassword = useCallback(
    async (username: string, password: string) => {
      // A login belongs to a profile, so there has to be one: save first, as for a passkey.
      if (!readRecord().key || unsaved(readRecord())) {
        if (!(await save(true))) return false;
      }
      const result = await setLogin(readRecord().key as string, username, password);
      if (!result.ok) {
        refuse(result);
        return false;
      }
      setMessage(null);
      const { signedOut } = result.body;
      toast(
        signedOut
          ? `Password changed. ${signedOut} other ${signedOut === 1 ? 'device was' : 'devices were'} signed out.`
          : 'Username and password set. Use them to sign in on a new device.',
        'SYNC',
      );
      return true;
    },
    [save, unsaved, refuse, toast],
  );

  const removePassword = useCallback(async () => {
    const key = readRecord().key;
    if (!key) return false;
    const result = await removeLogin(key);
    if (!result.ok) {
      refuse(result);
      return false;
    }
    toast('Password sign-in removed. Passkeys and sync links still work.', 'SYNC');
    return true;
  }, [refuse, toast]);

  const signInWithPassword = useCallback(
    async (username: string, password: string) => {
      let result = await passwordLogin(username, password);
      if (!result.ok && result.status === 403 && result.body?.challenge) {
        const siteKey = result.body.siteKey;
        const token = typeof siteKey === 'string' ? await turnstileToken(siteKey) : null;
        if (!token) {
          setMessage('Couldn’t confirm you’re not a robot. Try again.');
          return false;
        }
        result = await passwordLogin(username, password, token);
      }
      if (!result.ok) {
        refuse(result);
        return false;
      }
      return adoptLink(result.body.key);
    },
    [adoptLink, refuse],
  );

  const value = useMemo<SyncContextValue>(
    () => ({
      status,
      message,
      savedAt,
      hasKey: record.key !== null,
      passkeysSupported: typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function',
      createLink,
      adoptLink,
      signOutOtherDevices,
      deleteCloudCopy,
      turnOn,
      connectAssistant,
      remoteControl,
      setRemoteControl,
      refresh,
      addPasskey,
      signInWithPasskey,
      loginName,
      setPassword,
      removePassword,
      signInWithPassword,
    }),
    [
      status,
      message,
      savedAt,
      record.key,
      createLink,
      adoptLink,
      signOutOtherDevices,
      deleteCloudCopy,
      turnOn,
      connectAssistant,
      remoteControl,
      setRemoteControl,
      refresh,
      addPasskey,
      signInWithPasskey,
      loginName,
      setPassword,
      removePassword,
      signInWithPassword,
    ],
  );

  return (
    <SyncContext.Provider value={value}>
      {children}
      <Modal
        open={incoming !== null}
        onClose={() => {
          setIncoming(null);
          start();
        }}
        title="Load your modes from another device?"
        description="This browser already has modes of its own. Loading replaces them with the ones from the link."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:border-primary/60"
            onClick={() => {
              setIncoming(null);
              start();
            }}
          >
            Keep this browser’s
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:brightness-110"
            onClick={() => {
              const key = incoming;
              setIncoming(null);
              if (key) void adoptLink(key);
            }}
          >
            Load them
          </button>
        </div>
      </Modal>
    </SyncContext.Provider>
  );
}
