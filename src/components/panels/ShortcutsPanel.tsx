import { Modal } from '@/components/ui/Modal';
import { useVibe } from '@/state/vibe-context';

const GLOBAL: [string, string][] = [
  ['Space', 'Play / pause'],
  ['←', 'Previous track'],
  ['→', 'Next track'],
  ['M', 'Mute / unmute'],
  ['Ctrl / ⌘ + K', 'Open the mode picker'],
  ['?', 'This panel'],
  ['Esc', 'Close whatever is open'],
];

/** Easter eggs that only make sense inside a particular world. */
const PER_MODE: Record<string, [string, string][]> = {
  metro: [
    ['A', 'Station announcement'],
    ['Click the LED board', 'Same announcement'],
  ],
  'indian-train': [['Click the window', 'Change how fast the scenery goes past']],
  'cab-wala': [
    ['R', 'Reroute'],
    ['Click the nav screen', 'Same reroute'],
  ],
  'judaad-house': [
    ['Click the screwdriver', 'Jugaad mode activated'],
    ['Click the chai', 'Chai required'],
    ['Click the lamp', 'Lights off'],
  ],
  office: [['Click the monitor', 'Read the next line of the log']],
};

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
  const { theme, themes } = useVibe();
  const modeShortcuts = PER_MODE[theme.id] ?? [];

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

        {modeShortcuts.length > 0 && (
          <section>
            <h3 className="vm-label mb-1 text-muted">In {theme.name}</h3>
            <div className="divide-y divide-line/50">
              {modeShortcuts.map(([keys, action]) => (
                <Row key={keys} keys={keys} action={action} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
