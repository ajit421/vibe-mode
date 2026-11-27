import { Modal } from '@/components/ui/Modal';
import { useVibe } from '@/state/vibe-context';

const GLOBAL: [string, string][] = [
  ['Space', 'Play / pause'],
  ['←', 'Previous track'],
  ['→', 'Next track'],
  ['M', 'Mute / unmute'],
  ['Ctrl / ⌘ + K', 'Open the mode picker'],
  ['C', 'Customize modes'],
  ['?', 'This panel'],
  ['Esc', 'Close whatever is open'],
];

/** A key drawn as a keycap: a hairline, and a darker bottom edge so it reads as raised. */
const KEY =
  'inline-flex min-w-6 shrink-0 items-center justify-center rounded-md border border-line bg-ink/8 px-2 py-0.5 font-mono text-[0.7rem] text-ink shadow-[0_2px_0_0_rgba(0,0,0,0.45)]';

function Row({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-ink/[0.04]">
      <span className="text-sm text-ink/85">{action}</span>
      <kbd className={KEY}>{keys}</kbd>
    </div>
  );
}

export function ShortcutsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { themes, themeId } = useVibe();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Nothing here overrides your browser."
    >
      <div className="flex flex-col gap-6">
        <section>
          <h3 className="vm-label mb-2 border-b border-line/50 pb-2 text-primary">Anywhere</h3>
          <div className="-mx-2">
            {GLOBAL.map(([keys, action]) => (
              <Row key={keys} keys={keys} action={action} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="vm-label mb-3 border-b border-line/50 pb-2 text-primary">Jump to a mode</h3>
          {/* A grid of small tiles, key first: nine one-key rows read faster
              side by side than as a second long list. The mode you're in is
              marked, so the numbers have a "you are here". */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {themes.slice(0, 9).map((item, index) => (
              <div
                key={item.id}
                className={
                  item.id === themeId
                    ? 'flex items-center gap-2.5 rounded-lg border border-primary/50 bg-primary/10 px-2.5 py-2'
                    : 'flex items-center gap-2.5 rounded-lg border border-line/60 bg-ink/[0.03] px-2.5 py-2'
                }
              >
                <kbd className={KEY}>{index + 1}</kbd>
                <span className="truncate text-sm text-ink/85">{item.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* The per-mode section is gone: those shortcuts drove animations
            inside the drawn scenes, which the background pictures replaced. */}
      </div>
    </Modal>
  );
}
