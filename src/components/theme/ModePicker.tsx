import { useVibe } from '@/state/vibe-context';
import { ThemeCard } from './ThemeCard';
import { cn } from '@/utils/cn';

interface ModePickerProps {
  onSelect: (themeId: string) => void;
  /** `rail` scrolls horizontally on small screens; `grid` always wraps. */
  layout?: 'rail' | 'grid';
  className?: string;
}

/**
 * The mode selector. Reads straight from the theme registry, so a new theme
 * appears here the moment it is added to `src/themes/index.ts`.
 */
export function ModePicker({ onSelect, layout = 'rail', className }: ModePickerProps) {
  const { themes, themeId, motionEnabled } = useVibe();

  return (
    <div
      className={cn(
        layout === 'rail'
          ? // Horizontal, snapping rail on phones; a real grid from `sm` up.
            'vm-no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-5'
          : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
        layout === 'rail' && 'sm:gap-4',
        className,
      )}
    >
      {themes.map((theme, index) => (
        <div
          key={theme.id}
          className={cn(
            layout === 'rail' && 'w-[72vw] shrink-0 snap-center sm:w-auto sm:shrink',
            'flex',
          )}
        >
          <ThemeCard
            theme={theme}
            index={index}
            selected={theme.id === themeId}
            onSelect={onSelect}
            shortcut={index < 9 ? index + 1 : undefined}
            motionEnabled={motionEnabled}
          />
        </div>
      ))}
    </div>
  );
}
