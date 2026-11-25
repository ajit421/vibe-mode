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
  googleSignIn,
  googleStatus as fetchGoogleStatus,
  googleUnlink,
  type ApiResult,
  type Profile,
} from '@/sync/api';
import { turnstileToken } from '@/sync/turnstile';
import { track } from '@/utils/analytics';
import { normaliseUsername, stretchPassword } from '@/sync/password';
import { PASSWORD_LENGTH } from '@/themes/limits';

/** Quiet time after the last change before saving — the Customize panel changes state per keystroke. */
const SAVE_DELAY_MS = 2_000;
const REMOTE_KEY = 'vibe-mode.remoteControl';
/** Coming back to the tab re-checks the cloud copy at most this often. */
const PULL_INTERVAL_MS = 30_000;
const SIGNED_IN = 'Signed in. Your modes are here.';

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
  /** Settles when the save in flight ends — what a forced save waits for. */
  const saveDone = useRef<Promise<void>>(Promise.resolve());
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
      // A forced save (a link, passkey, password or Google needs a cloud copy
      // now) waits for the autosave in flight instead of failing silently.
      while (saving.current && force) await saveDone.current;
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
      let finished = () => {};
      saveDone.current = new Promise<void>((resolve) => (finished = resolve));
      setStatus('saving');
      try {
        // The key is stored before the first request, so a second tab saving
        // at the same moment reuses it instead of making a second profile.
        if (!rec.key) {
          rec = { ...rec, key: newSyncKey() };
          store(rec);
        }
        const key = rec.key as string;
        const create = rec.version === null;
        // After every wait: if the key changed meanwhile (signed out, signed in
        // elsewhere, cloud copy deleted), this save is over — writing its old
        // key back would undo that.
        const superseded = () => readRecord().key !== key;

        const dataPrint = fingerprint(dataJson);
        if (rec.data !== dataPrint) {
          let result = await saveProfile(key, data, create);
          if (!result.ok && result.status === 403 && result.body?.challenge) {
            const siteKey = result.body.siteKey;
            const token = typeof siteKey === 'string' ? await turnstileToken(siteKey) : null;
            if (!token) {
              setStatus('error');
              setMessage('Couldn’t confirm you’re not a robot, so nothing was saved to the cloud.');
              return false;
            }
            result = await saveProfile(key, data, create, token);
          }
          if (superseded()) return false;
          if (!result.ok && result.status === 401) {
            forget(); // signed out from another device
            return false;
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
          if (superseded()) return false;
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
          if (superseded()) return false;
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
        finished();
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
    // The answer is stale if anything moved while it was on its way: a save
    // went out, an edit was made here, or the key changed. Laying it over
    // would replace newer work with older; send the edit instead.
    const now = readRecord();
    if (saving.current || now.key !== rec.key || unsaved(now)) {
      if (ready.current && !saving.current && now.key && unsaved(now)) void save();
      return;
    }
    if (result.ok) {
      // Unchanged since this browser last saw it: nothing to lay over.
      if (result.body.version !== rec.version) adopt(result.body, rec.key);
      else setStatus('saved');
    } else if (result.status === 401) {
      forget();
    } else {
      report(result);
    }
  }, [adopt, forget, report, save, unsaved]);

  /* ── A sync link opened on this device (`#sync=…`) ─────────────────────── */
  const [incoming, setIncoming] = useState<string | null>(() => parseSyncLink(window.location.hash));

  const adoptLink = useCallback(
    async (input: string, welcome = 'Your modes from the other device are here.'): Promise<boolean> => {
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
      toast(welcome, 'SYNC');
      // Passkey and password sign-ins come through here too and count their own.
      if (welcome !== SIGNED_IN) track('sign_in', 'sync link');
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
        // An edit made during the first load wasn't scheduled (not ready yet): send it now.
        if (adopting.current === null && unsaved(readRecord())) void save();
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
    if (key) track('sync_link_made');
    return key ? syncLink(key) : null;
  }, [mint]);

  const connectAssistant = useCallback(async () => {
    const key = await mint();
    if (key) track('ai_link_made');
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
    track('ai_control', on ? 'on' : 'off');
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
    track('sign_out_others');
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
    track('cloud_deleted');
    return true;
  }, [report, store, toast]);

  const leaveCloud = useCallback(() => {
    window.clearTimeout(timer.current);
    store({ ...EMPTY_RECORD });
    setStatus('idle');
    setMessage(null);
  }, [store]);

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
    track('passkey_added');
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
    // This browser's key goes along so the server can drop it: the new one replaces it.
    const result = await passkeyVerify(options.body.challengeId, response, readRecord().key);
    if (!result.ok || !result.body.key) {
      report(result);
      return false;
    }
    const ok = await adoptLink(result.body.key, SIGNED_IN);
    if (ok) track('sign_in', 'passkey');
    return ok;
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

  /** The stretched password, or null (with a message) when this browser can't make one. */
  const proofOf = useCallback(async (username: string, password: string) => {
    try {
      return await stretchPassword(username, password);
    } catch {
      setMessage('This browser can’t do password sign-in on this page. Try a passkey or a sync link.');
      return null;
    }
  }, []);

  const setPassword = useCallback(
    async (username: string, password: string) => {
      // Checked only here: the server sees the stretched password, never its length.
      if (password.length < PASSWORD_LENGTH.min || password.length > PASSWORD_LENGTH.max) {
        setMessage(`A password is ${PASSWORD_LENGTH.min} to ${PASSWORD_LENGTH.max} characters.`);
        return false;
      }
      const name = normaliseUsername(username);
      const proof = await proofOf(name, password);
      if (!proof) return false;
      // A login belongs to a profile, so there has to be one: save first, as for a passkey.
      if (!readRecord().key || unsaved(readRecord())) {
        if (!(await save(true))) return false;
      }
      const result = await setLogin(readRecord().key as string, name, proof);
      if (!result.ok) {
        refuse(result);
        return false;
      }
      setMessage(null);
      const { signedOut } = result.body;
      track('password_set');
      toast(
        signedOut
          ? `Password changed. ${signedOut} other ${signedOut === 1 ? 'device was' : 'devices were'} signed out.`
          : 'Username and password set. Use them to sign in on a new device.',
        'SYNC',
      );
      return true;
    },
    [proofOf, save, unsaved, refuse, toast],
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
      const name = normaliseUsername(username);
      const proof = await proofOf(name, password);
      if (!proof) return false;
      let result = await passwordLogin(name, proof, readRecord().key);
      if (!result.ok && result.status === 403 && result.body?.challenge) {
        const siteKey = result.body.siteKey;
        const token = typeof siteKey === 'string' ? await turnstileToken(siteKey) : null;
        if (!token) {
          setMessage('Couldn’t confirm you’re not a robot. Try again.');
          return false;
        }
        result = await passwordLogin(name, proof, readRecord().key, token);
      }
      if (!result.ok) {
        refuse(result);
        return false;
      }
      const ok = await adoptLink(result.body.key, SIGNED_IN);
      if (ok) track('sign_in', 'password');
      return ok;
    },
    [adoptLink, proofOf, refuse],
  );

  /* ── Continue with Google (functions/api/google.ts) ────────────────────── */

  /** Set while the "replace this browser's modes?" dialog is open: the token to retry with. */
  const [googlePending, setGooglePending] = useState<{ credential: string; email: string | null } | null>(null);

  const googleStatus = useCallback(async () => {
    const result = await fetchGoogleStatus(readRecord().key);
    return result.ok
      ? { clientId: result.body.clientId, email: result.body.email, linked: result.body.linked }
      : { clientId: null, email: null, linked: false };
  }, []);

  const continueWithGoogle = useCallback(
    async (credential: string, replace = false): Promise<boolean> => {
      // Modes here that the cloud doesn't have yet are saved first, so they are
      // either linked to the Google account or protected by the dialog below —
      // never silently replaced.
      const rec = readRecord();
      if (!latest.current.empty && (!rec.key || unsaved(rec))) {
        if (!(await save(true))) return false;
      }
      let result = await googleSignIn(credential, readRecord().key, replace);
      if (!result.ok && result.status === 404 && result.body?.link) {
        // A new Google account and nothing saved here yet: make the cloud copy to link it to.
        if (!(await save(true))) return false;
        result = await googleSignIn(credential, readRecord().key, replace);
      }
      if (!result.ok && result.status === 409 && result.body?.confirm) {
        const email = typeof result.body.email === 'string' ? result.body.email : null;
        setGooglePending({ credential, email });
        return false;
      }
      if (!result.ok) {
        refuse(result);
        return false;
      }
      const { key, linked, same, email } = result.body;
      if (key) {
        const ok = await adoptLink(key, email ? `Signed in as ${email}. Your modes are here.` : SIGNED_IN);
        if (ok) track('sign_in', 'google');
        return ok;
      }
      setMessage(null);
      if (linked) {
        track('google_linked');
        toast(`Google account connected${email ? ` (${email})` : ''}. Use it to sign in on any device.`, 'SYNC');
      } else if (same) {
        toast('You’re already signed in with this Google account.', 'SYNC');
      }
      return true;
    },
    [adoptLink, refuse, save, toast, unsaved],
  );

  const disconnectGoogle = useCallback(async () => {
    const key = readRecord().key;
    if (!key) return false;
    const result = await googleUnlink(key);
    if (!result.ok) {
      refuse(result);
      return false;
    }
    toast('Google account disconnected. Passkeys and sync links still work.', 'SYNC');
    return true;
  }, [refuse, toast]);

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
      leaveCloud,
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
      googleStatus,
      continueWithGoogle,
      disconnectGoogle,
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
      leaveCloud,
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
      googleStatus,
      continueWithGoogle,
      disconnectGoogle,
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
      <Modal
        open={googlePending !== null}
        onClose={() => setGooglePending(null)}
        title="Load your Google account’s modes?"
        description={`${googlePending?.email ?? 'That Google account'} already has its own modes. Signing in replaces this browser’s with those.`}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:border-primary/60"
            onClick={() => setGooglePending(null)}
          >
            Keep this browser’s
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:brightness-110"
            onClick={() => {
              const pending = googlePending;
              setGooglePending(null);
              if (pending) void continueWithGoogle(pending.credential, true);
            }}
          >
            Load them
          </button>
        </div>
      </Modal>
    </SyncContext.Provider>
  );
}
