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
  parseSyncLink,
  readRecord,
  safeAccount,
  splitBackup,
  syncLink,
  writeRecord,
  type Account,
  type SyncRecord,
} from '@/sync/sync';
import {
  deleteProfile,
  deleteUpload,
  googleSignIn,
  googleStatus,
  loadProfile,
  mintKey,
  saveProfile,
  saveUpload,
  signOutOthers,
  signOutSelf,
  type ApiResult,
  type Profile,
} from '@/sync/api';
import { track } from '@/utils/analytics';

/** Quiet time after the last change before saving — the Customize panel changes state per keystroke. */
const SAVE_DELAY_MS = 2_000;
const REMOTE_KEY = 'vibe-mode.remoteControl';
/** Coming back to the tab re-checks the cloud copy at most this often. */
const PULL_INTERVAL_MS = 30_000;
const NEEDS_GOOGLE = 'Sign in with Google to keep saving your modes to the cloud.';

/** The Client ID, asked once per page (it doesn't change while the page is open). */
let clientIdOnce: Promise<string | null> | null = null;

/*
 * Keeps a signed-in visitor's changes in the cloud (D1) as well as in this
 * browser. Cloud save is a signed-in (Google) feature: without signing in,
 * nothing is sent and modes stay in this browser.
 *
 *  - Signing in (`continueWithGoogle`): a Google account new to the site
 *    starts from this browser's modes; one that already has modes is loaded —
 *    after asking, if this browser has modes of its own.
 *  - Saving: any change to what "Download my settings" would contain is sent
 *    two seconds after the last one. Text and pictures go separately, and a
 *    picture only when it changed.
 *  - Loading: on page load and on coming back to the tab, the cloud copy
 *    replaces this browser's — unless this browser has changes it hasn't
 *    sent yet, which then win and are sent.
 *  - What was last saved is fingerprinted in localStorage (`vibe-mode.sync`),
 *    shared by every tab, so one tab's save isn't repeated by the others and
 *    a change made offline is still sent after a reload.
 *  - A browser with a cloud copy from before Google sign-in keeps its key; the
 *    server answers 403 `google` until it signs in, which links that copy.
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
    !record.key ? 'signed-out' : record.account ? 'saved' : 'saving',
  );
  const [message, setMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  /** Writes the record for every tab, and shows it here. */
  const store = useCallback((next: SyncRecord) => {
    writeRecord(next);
    setRecord(next);
  }, []);

  // Another tab saved, signed in or signed out.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SYNC_STORAGE_KEY) return;
      const next = readRecord();
      setRecord(next);
      if (!next.key) setStatus('signed-out');
      else if (next.account) setStatus((now) => (now === 'signed-out' || now === 'needs-google' ? 'saved' : now));
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

  /** A refusal of what the visitor did (a sign-in Google rejected) is no failed save: the status stays. */
  const refuse = useCallback(
    (result: ApiResult<unknown>) => {
      if (result.ok) return;
      if (result.status === 0) report(result);
      else setMessage(result.error);
    },
    [report],
  );

  /** 403 { google }: this browser's cloud copy is from before Google sign-in. */
  const needsGoogle = useCallback((result: ApiResult<unknown>) => {
    if (result.ok || result.status !== 403 || !result.body?.google) return false;
    setStatus('needs-google');
    setMessage(NEEDS_GOOGLE);
    return true;
  }, []);

  /** Lays a cloud copy over this browser. */
  const adopt = useCallback(
    (profile: Profile, key: string) => {
      adopting.current = profile.version;
      store({ ...readRecord(), key, account: safeAccount(profile.account), off: false, version: profile.version });
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
    setStatus('signed-out');
    setMessage('This browser was signed out. Your modes here are untouched.');
  }, [store]);

  const save = useCallback(
    async (force = false): Promise<boolean> => {
      window.clearTimeout(timer.current);
      // A forced save (a link needs the cloud copy current) waits for the
      // autosave in flight instead of failing silently.
      while (saving.current && force) await saveDone.current;
      if (saving.current) {
        saveAgain.current = true;
        return false;
      }
      let rec = readRecord();
      // Not signed in: nothing goes to the cloud. Modes stay in this browser.
      // A key with no account yet (a copy from before Google, or a browser
      // signed in before accounts were recorded) is confirmed by a load first
      // (`start` → `pull`), not by a save on every change; forced saves come
      // right after a sign-in, which sets the account.
      if (!rec.key || (!rec.account && !force)) return true;
      const { data, dataJson, uploads } = latest.current;
      if (!unsaved(rec)) {
        if (rec.account) setStatus('saved');
        return true;
      }

      saving.current = true;
      let finished = () => {};
      saveDone.current = new Promise<void>((resolve) => (finished = resolve));
      setStatus('saving');
      try {
        const key = rec.key;
        // After every wait: if the key changed meanwhile (signed out, signed in
        // elsewhere, cloud copy deleted), this save is over — writing its old
        // key back would undo that.
        const superseded = () => readRecord().key !== key;

        const dataPrint = fingerprint(dataJson);
        if (rec.data !== dataPrint) {
          const result = await saveProfile(key, data);
          if (superseded()) return false;
          if (needsGoogle(result)) return false;
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
          if (needsGoogle(result)) return false;
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
          if (needsGoogle(result)) return false;
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
    [unsaved, report, forget, store, needsGoogle],
  );

  const pull = useCallback(async () => {
    const rec = readRecord();
    if (!rec.key) return;
    lastPull.current = Date.now();
    const result = await loadProfile(rec.key);
    // The account rides along: keep the profile icon current (or learn of it
    // for the first time, on a browser signed in before it was recorded).
    if (result.ok && readRecord().key === rec.key) {
      const account = safeAccount(result.body.account);
      if (JSON.stringify(account) !== JSON.stringify(readRecord().account)) store({ ...readRecord(), account });
    }
    // A refusal is about the key, whatever happened here meanwhile — handled
    // before the staleness check below, or a browser with unsent changes (a
    // copy from before Google always has some) would never hear it.
    if (!result.ok) {
      if (readRecord().key !== rec.key) return;
      if (needsGoogle(result)) return; // kept: signing in with Google links this copy
      if (result.status === 401) forget();
      else report(result);
      return;
    }
    // The answer is stale if anything moved while it was on its way: a save
    // went out, an edit was made here, or the key changed. Laying it over
    // would replace newer work with older; send the edit instead.
    const now = readRecord();
    if (saving.current || now.key !== rec.key || unsaved(now)) {
      if (ready.current && !saving.current && now.key && now.account && unsaved(now)) void save();
      return;
    }
    // Unchanged since this browser last saw it: nothing to lay over.
    if (result.body.version !== rec.version) adopt(result.body, rec.key);
    else setStatus('saved');
  }, [adopt, forget, report, save, unsaved, store, needsGoogle]);

  /* ── A sync link opened on this device (`#sync=…`) ─────────────────────── */
  const [incoming, setIncoming] = useState<string | null>(() => parseSyncLink(window.location.hash));

  const adoptLink = useCallback(
    async (input: string, welcome = 'Signed in. Your modes from the other device are here.'): Promise<boolean> => {
      const key = parseSyncLink(input);
      if (!key) {
        setMessage('That isn’t a sync link. Copy the whole link from your other device.');
        return false;
      }
      setStatus('saving');
      const result = await loadProfile(key);
      ready.current = true;
      if (!result.ok) {
        setStatus(readRecord().key ? (readRecord().account ? 'saved' : 'needs-google') : 'signed-out');
        if (result.status === 401) setMessage('That link doesn’t work any more. Make a new one on your other device.');
        else if (result.status === 403) setMessage('That link is from before Google sign-in. Sign in with Google there, then make a new link.');
        else report(result);
        return false;
      }
      adopt(result.body, key);
      toast(welcome, 'SYNC');
      return true;
    },
    [adopt, report, toast],
  );

  const start = useCallback(() => {
    const rec = readRecord();
    if (!rec.key) {
      ready.current = true;
      return;
    }
    // Changes made here and not yet sent (offline, or closed within the
    // two-second wait) win over the cloud copy; otherwise the cloud copy wins.
    if (rec.account && unsaved(rec)) {
      ready.current = true;
      void save();
    } else {
      void pull().finally(() => {
        ready.current = true;
        // An edit made during the first load wasn't scheduled (not ready yet): send it now.
        if (adopting.current === null && readRecord().account && unsaved(readRecord())) void save();
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
        void adoptLink(incoming).then((ok) => ok && track('sign_in', 'sync link'));
      }
      return;
    }
    start();
    // Runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every change: save after a quiet spell (only signed in — `save` checks).
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
    if (!ready.current || !readRecord().key) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), SAVE_DELAY_MS);
  }, [backup, save, store]);

  // Back to the tab, or back online: send what's waiting, or fetch what changed elsewhere.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible' || !ready.current || saving.current) return;
      const rec = readRecord();
      if (!rec.key) return;
      if (rec.account && unsaved(rec)) void save();
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

  /* ── Signing in with Google ────────────────────────────────────────────── */

  const googleClientId = useCallback(() => {
    clientIdOnce ??= googleStatus(null).then((result) => (result.ok ? result.body.clientId : null));
    return clientIdOnce;
  }, []);

  /** The account already has modes and so does this browser: which to keep (a dialog). */
  const [choice, setChoice] = useState<{ key: string; account: Account | null } | null>(null);

  const continueWithGoogle = useCallback(
    async (credential: string): Promise<boolean> => {
      const { data, dataJson, empty } = latest.current;
      const result = await googleSignIn(credential, readRecord().key, data);
      if (!result.ok) {
        refuse(result);
        return false;
      }
      const { key, created, linked, same, version } = result.body;
      const account = safeAccount(result.body.account);
      const who = account?.email ?? account?.name ?? 'your Google account';
      setMessage(null);

      if (same || linked) {
        // Already this account, or this browser's older cloud copy was linked to it.
        store({ ...readRecord(), account });
        ready.current = true;
        setStatus('saving');
        void save(true);
        toast(linked ? `Signed in as ${who}. Your cloud copy is now part of your account.` : `You’re signed in as ${who}.`, 'SYNC');
        track('sign_in', 'google');
        return true;
      }
      if (!key) return false;
      if (created) {
        // A new account, made from this browser's modes: they are what is saved.
        store({ key, account, data: fingerprint(dataJson), uploads: {}, version: version ?? null, off: false });
        ready.current = true;
        void save(true); // pictures follow
        toast(`Signed in as ${who}. Your modes are saved to your account.`, 'SYNC');
        track('sign_in', 'google');
        return true;
      }
      // The account already has modes.
      if (empty) {
        const ok = await adoptLink(key, `Signed in as ${who}. Your modes are here.`);
        if (ok) track('sign_in', 'google');
        return ok;
      }
      setChoice({ key, account });
      return false;
    },
    [adoptLink, refuse, save, store, toast],
  );

  /** The dialog's answer. Load = the account's modes replace this browser's; keep = the reverse. */
  const settleChoice = useCallback(
    async (keepThisBrowser: boolean) => {
      const pending = choice;
      setChoice(null);
      if (!pending) return;
      const who = pending.account?.email ?? 'your Google account';
      if (keepThisBrowser) {
        // This browser's modes win: saved over the account's cloud copy.
        store({ key: pending.key, account: pending.account, data: null, uploads: {}, version: null, off: false });
        ready.current = true;
        await save(true);
        toast(`Signed in as ${who}. This browser’s modes are now your account’s.`, 'SYNC');
      } else {
        await adoptLink(pending.key, `Signed in as ${who}. Your modes are here.`);
      }
      track('sign_in', 'google');
    },
    [choice, adoptLink, save, store, toast],
  );

  /* ── Actions for the Account panel ─────────────────────────────────────── */

  /** A fresh device key for this account — for a sync link. */
  const mint = useCallback(async (): Promise<string | null> => {
    if (!readRecord().account) return null;
    // The other device should get what is here now.
    if (unsaved(readRecord()) && !(await save(true))) return null;
    const result = await mintKey(readRecord().key as string);
    if (!result.ok) {
      if (!needsGoogle(result)) report(result);
      return null;
    }
    return result.body.key;
  }, [save, unsaved, report, needsGoogle]);

  const createLink = useCallback(async () => {
    const key = await mint();
    if (key) track('sync_link_made');
    return key ? syncLink(key) : null;
  }, [mint]);

  const refresh = useCallback(() => {
    const rec = readRecord();
    if (!ready.current || saving.current || !rec.key) return;
    if (rec.account && unsaved(rec)) void save();
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
      if (!needsGoogle(result)) report(result);
      return false;
    }
    toast(
      result.body.removed === 1 ? 'Signed out 1 other device.' : `Signed out ${result.body.removed} other devices.`,
      'SYNC',
    );
    track('sign_out_others');
    return true;
  }, [report, toast, needsGoogle]);

  const leaveCloud = useCallback(() => {
    window.clearTimeout(timer.current);
    setRemoteControl(false);
    store({ ...EMPTY_RECORD });
    setStatus('signed-out');
    setMessage(null);
  }, [store, setRemoteControl]);

  const signOut = useCallback(async () => {
    const key = readRecord().key;
    // Whatever is waiting goes up first, so the account has it on the other devices.
    if (key && readRecord().account && unsaved(readRecord())) await save(true);
    if (key) await signOutSelf(key); // best effort: offline, the key just stays unused
    leaveCloud();
    toast('Signed out. Your modes stay in this browser.', 'SYNC');
    track('sign_out');
    return true;
  }, [leaveCloud, save, unsaved, toast]);

  const deleteCloudCopy = useCallback(async () => {
    const key = readRecord().key;
    if (key) {
      const result = await deleteProfile(key);
      if (!result.ok && result.status !== 401) {
        report(result);
        return false;
      }
    }
    leaveCloud();
    toast('Cloud copy deleted. Your modes are still here in this browser.', 'SYNC');
    track('cloud_deleted');
    return true;
  }, [report, leaveCloud, toast]);

  const value = useMemo<SyncContextValue>(
    () => ({
      status,
      message,
      savedAt,
      account: record.key ? record.account : null,
      hasKey: record.key !== null,
      googleClientId,
      continueWithGoogle,
      signOut,
      createLink,
      adoptLink,
      signOutOtherDevices,
      deleteCloudCopy,
      leaveCloud,
      remoteControl,
      setRemoteControl,
      refresh,
    }),
    [
      status,
      message,
      savedAt,
      record.key,
      record.account,
      googleClientId,
      continueWithGoogle,
      signOut,
      createLink,
      adoptLink,
      signOutOtherDevices,
      deleteCloudCopy,
      leaveCloud,
      remoteControl,
      setRemoteControl,
      refresh,
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
              if (key) void adoptLink(key).then((ok) => ok && track('sign_in', 'sync link'));
            }}
          >
            Load them
          </button>
        </div>
      </Modal>
      <Modal
        open={choice !== null}
        // Closing without choosing means the usual thing a sign-in does: load the account.
        onClose={() => void settleChoice(false)}
        title="Your account already has modes"
        description={`${choice?.account?.email ?? 'Your Google account'} has its own modes in the cloud, and this browser has some too. Which should you keep?`}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:border-primary/60"
            onClick={() => void settleChoice(true)}
          >
            Keep this browser’s
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:brightness-110"
            onClick={() => void settleChoice(false)}
          >
            Load my account’s
          </button>
        </div>
      </Modal>
    </SyncContext.Provider>
  );
}
