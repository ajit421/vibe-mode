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

function Row({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted">{action}</span>
      <kbd className="shrink-0 rounded-md border border-line bg-ink/6 px-2 py-1 font-mono text-[0.7rem] text-ink">
        {keys}
      </kbd>
    </div>
  );
}

export function ShortcutsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { themes } = useVibe();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Nothing here overrides your browser."
    >
      <div className="flex flex-col gap-6">
        <section>
          <h3 className="vm-label mb-1 text-muted">Anywhere</h3>
          <div className="divide-y divide-line/50">
            {GLOBAL.map(([keys, action]) => (
              <Row key={keys} keys={keys} action={action} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="vm-label mb-1 text-muted">Jump to a mode</h3>
          <div className="divide-y divide-line/50">
            {themes.slice(0, 9).map((item, index) => (
              <Row key={item.id} keys={String(index + 1)} action={item.name} />
            ))}
          </div>
        </section>

        {/* The per-mode section is gone: those shortcuts drove animations
            inside the drawn scenes, which the background pictures replaced. */}
      </div>
    </Modal>
  );
}
