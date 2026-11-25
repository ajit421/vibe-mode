import { useEffect, useState, type ReactNode } from 'react';
import {
  Bot,
  Check,
  Cloud,
  CloudOff,
  Copy,
  Link2,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { ConfirmButton, SMALL_BUTTON } from '@/components/ui/ConfirmButton';
import { GoogleButton } from '@/components/account/GoogleButton';
import { Avatar } from '@/components/account/Avatar';
import { useSync } from '@/state/sync-context';
import { useToast } from '@/state/toast-context';
import { cn } from '@/utils/cn';

interface AccountPanelProps {
  open: boolean;
  onClose: () => void;
}

/** What signing in with Google unlocks — the "premium" tier, shown to visitors who haven't. */
const PERKS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <Cloud />,
    title: 'Cloud save',
    text: 'Your modes, playlists and pictures, saved as you change them.',
  },
  {
    icon: <MonitorSmartphone />,
    title: 'Every device',
    text: 'Sign in on your phone and laptop — the same modes on both.',
  },
  {
    icon: <Bot />,
    title: 'Your AI assistant',
    text: 'Let Claude or ChatGPT switch modes and play music for you.',
  },
  {
    icon: <Link2 />,
    title: 'One-tap links',
    text: 'Send a link that signs another device straight in.',
  },
];

/**
 * The profile icon's panel: signing in with Google, and everything that needs
 * it (src/state/SyncProvider.tsx does the work). A native <dialog> like every
 * panel (Modal.tsx); toasts sit behind it, so it shows its own messages.
 */
export function AccountPanel({ open, onClose }: AccountPanelProps) {
  const sync = useSync();
  const { account } = sync;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? 'Your account' : 'Sign in to Vibe Mode'}
      description={
        account
          ? 'Cloud save, your devices and your AI assistant.'
          : 'Free, with your Google account. Everything else keeps working without it.'
      }
    >
      {sync.message && (
        <p role="status" className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-ink">
          {sync.message}
        </p>
      )}
      {account ? <SignedIn /> : <SignedOut />}
    </Modal>
  );
}

function SignedOut() {
  const sync = useSync();
  const { googleClientId } = sync;
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void googleClientId().then(setClientId);
  }, [googleClientId]);

  return (
    <div className="flex flex-col gap-5">
      {sync.status === 'needs-google' && (
        <p className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-ink">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          This browser has a cloud copy from before Google sign-in. Sign in to keep it — your modes come with you.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {PERKS.map((perk) => (
          <li key={perk.title} className="flex gap-3 rounded-xl border border-line/70 bg-canvas/40 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary [&_svg]:size-[18px]">
              {perk.icon}
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">{perk.title}</span>
              <span className="block text-xs text-muted">{perk.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center gap-2">
        {clientId === undefined ? (
          <p className="text-sm text-muted">Getting sign-in ready…</p>
        ) : clientId === null ? (
          <p className="text-sm text-muted">Sign-in isn’t set up on this site yet.</p>
        ) : (
          <div className={cn(busy && 'pointer-events-none opacity-60')}>
            <GoogleButton
              clientId={clientId}
              onCredential={(credential) => {
                setBusy(true);
                void sync.continueWithGoogle(credential).finally(() => setBusy(false));
              }}
            />
          </div>
        )}
        <p className="max-w-sm text-center text-xs text-muted">
          We get your name, email and photo — nothing else. Your modes stay in this browser if you
          don’t sign in.{' '}
          <a className="underline hover:text-ink" href="/privacy" target="_blank" rel="noopener">
            Privacy
          </a>
        </p>
      </div>
    </div>
  );
}

const STATUS: Record<string, string> = {
  saved: 'Saved to the cloud',
  saving: 'Saving…',
  offline: 'Offline — saved when you’re back',
  error: 'The last save didn’t go through',
};

function SignedIn() {
  const sync = useSync();
  const { push } = useToast();
  const account = sync.account!;
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const mcp = `${window.location.origin}/mcp`;

  const run = (task: () => Promise<unknown>) => {
    setBusy(true);
    return task().finally(() => setBusy(false));
  };
  const copy = (text: string, what: string) =>
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(what);
        window.setTimeout(() => setCopied((now) => (now === what ? null : now)), 2000);
      })
      .catch(() => push('Couldn’t copy — select it and copy it by hand.', 'SYNC'));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Who ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 rounded-2xl border border-line/70 bg-canvas/40 p-4">
        <Avatar account={account} className="size-14 text-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold text-ink">{account.name ?? 'Signed in'}</p>
          {account.email && <p className="truncate text-sm text-muted">{account.email}</p>}
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted" role="status">
            <span
              className={cn(
                'size-2 rounded-full',
                sync.status === 'saved' ? 'bg-emerald-400' : sync.status === 'error' ? 'bg-red-400' : 'bg-amber-400',
              )}
              aria-hidden="true"
            />
            {STATUS[sync.status] ?? ''}
            {sync.status === 'saved' && sync.savedAt
              ? ` · ${new Date(sync.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </p>
        </div>
        <button
          type="button"
          className={cn(SMALL_BUTTON, 'shrink-0')}
          onClick={sync.refresh}
          aria-label="Check for changes from your other devices"
          title="Check for changes from your other devices"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {/* ── Devices ─────────────────────────────────────────────────────── */}
      <Group title="Your devices" icon={<MonitorSmartphone />}>
        <p className="text-xs text-muted">
          Sign in with Google on any device to get these modes there. A one-tap link signs a device in
          without it — send it only to yourself.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SMALL_BUTTON}
            disabled={busy}
            onClick={() => run(async () => setLink(await sync.createLink()))}
          >
            <Link2 className="size-3.5" />
            Link another device
          </button>
          <ConfirmButton
            label="Sign out other devices"
            confirmLabel="Sure? Sign them all out"
            icon={<LogOut className="size-3.5" />}
            disabled={busy}
            onConfirm={() => run(sync.signOutOtherDevices)}
          />
        </div>
        {link && (
          <div className="flex flex-col gap-1.5">
            <CopyField value={link} label="Link for your other device" copied={copied === 'link'} onCopy={() => copy(link, 'link')} />
            <p className="flex items-start gap-1.5 text-xs text-muted">
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-primary" />
              Anyone with this link can open your account. If it went somewhere it shouldn’t, use “Sign out
              other devices”.
            </p>
          </div>
        )}
      </Group>

      {/* ── AI assistant ────────────────────────────────────────────────── */}
      <Group title="Your AI assistant" icon={<Bot />}>
        <p className="text-xs text-muted">
          Your personal MCP server. Add it as a custom connector in Claude or ChatGPT — it asks you to sign
          in with Google once, then can change your modes, playlists and the player.
        </p>
        <CopyField value={mcp} label="Your MCP server address" copied={copied === 'mcp'} onCopy={() => copy(mcp, 'mcp')} />
        <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted">
          <li>
            <span className="text-ink">Claude:</span> Settings → Connectors → Add custom connector → paste.
          </li>
          <li>
            <span className="text-ink">ChatGPT:</span> Settings → Apps &amp; Connectors → Create → paste, sign-in: OAuth.
          </li>
        </ol>
        <Switch
          checked={sync.remoteControl}
          onChange={sync.setRemoteControl}
          label="Let AI control this tab"
          description="Your assistant can play, pause, skip, switch mode and change the volume here. Checks every few seconds while on."
        />
      </Group>

      {/* ── Leaving ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-4">
        <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={() => run(sync.signOut)}>
          <UserRound className="size-3.5" />
          Sign out
        </button>
        <ConfirmButton
          label="Delete my cloud copy"
          confirmLabel="Sure? Delete for good"
          icon={<CloudOff className="size-3.5" />}
          disabled={busy}
          className="hover:border-red-400/60 hover:text-red-300"
          onConfirm={() => run(sync.deleteCloudCopy)}
        />
      </div>
    </div>
  );
}

function Group({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink [&_svg]:size-4 [&_svg]:text-primary">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function CopyField({ value, label, copied, onCopy }: { value: string; label: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex gap-2">
      <input
        readOnly
        aria-label={label}
        className="w-full min-w-0 rounded-lg border border-line bg-canvas/60 px-3 py-2 font-mono text-xs text-ink focus-visible:border-primary/60"
        value={value}
        onFocus={(event) => event.currentTarget.select()}
      />
      <button type="button" className={cn(SMALL_BUTTON, 'shrink-0')} onClick={onCopy}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
