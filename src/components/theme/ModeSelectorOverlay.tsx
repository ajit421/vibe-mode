import { Modal } from '@/components/ui/Modal';
import { useVibe } from '@/state/vibe-context';
import { ModePicker } from './ModePicker';

/** The mode picker as a dialog, for switching worlds without leaving one. */
export function ModeSelectorOverlay() {
  const { selectorOpen, setSelectorOpen, selectTheme } = useVibe();

  return (
    <Modal
      open={selectorOpen}
      onClose={() => setSelectorOpen(false)}
      title="Where are you now?"
      description="The music follows you."
      size="lg"
    >
      <ModePicker layout="grid" onSelect={selectTheme} />
    </Modal>
  );
}
