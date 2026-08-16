import { motion } from 'motion/react';
import { Check, ListMusic } from 'lucide-react';
import type { VibeTheme } from '@/types/theme';
import { MiniPreview } from '@/components/visuals/MiniPreview';
import { preloadVisual } from '@/components/visuals/registry';
import { cn } from '@/utils/cn';

interface ThemeCardProps {
  theme: VibeTheme;
  selected: boolean;
  onSelect: (themeId: string) => void;
  /** 1-based position, shown as the keyboard shortcut hint. */
  shortcut?: number;
  motionEnabled: boolean;
  index: number;
}

export function ThemeCard({
  theme,
  selected,
  onSelect,
  shortcut,
  motionEnabled,
  index,
}: ThemeCardProps) {
  const Icon = theme.icon;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(theme.id)}
      onMouseEnter={() => preloadVisual(theme.hero.visual)}
      onFocus={() => preloadVisual(theme.hero.visual)}
      aria-pressed={selected}
      initial={motionEnabled ? { opacity: 0, y: 22 } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={motionEnabled ? { y: -6 } : undefined}
      whileTap={{ scale: 0.985 }}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-2xl border text-left',
        'transition-[border-color,box-shadow] duration-300',
        selected
          ? 'border-primary/70 shadow-xl shadow-glow/20'
          : 'border-line hover:border-primary/45',
      )}
      style={{ backgroundColor: theme.colors.surface }}
    >
      {/* Animated preview of the world */}
      <div className="relative h-24 w-full overflow-hidden sm:h-28">
        <MiniPreview theme={theme} still={!motionEnabled} />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${theme.colors.surface}, transparent 65%)`,
          }}
          aria-hidden="true"
        />
        {selected && (
          <span
            className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full"
            style={{ backgroundColor: theme.colors.primary }}
          >
            <Check className="size-3.5" style={{ color: theme.colors.background }} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 pt-1 pb-4">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0" style={{ color: theme.colors.primary }} />
          {/* Spans, not headings — a <button> may only contain phrasing content. */}
          <span
            className="font-display text-base font-semibold"
            style={{ color: theme.colors.text }}
          >
            {theme.name}
          </span>
          <span className="ml-auto text-lg" aria-hidden="true">
            {theme.emoji}
          </span>
        </div>

        <span className="text-[0.82rem] leading-relaxed" style={{ color: theme.colors.muted }}>
          {theme.description}
        </span>

        <div
          className="mt-auto flex items-center gap-1.5 pt-1.5 font-mono text-[0.65rem]"
          style={{ color: theme.colors.muted }}
        >
          <ListMusic className="size-3" />
          <span>
            {theme.playlists.length} playlist{theme.playlists.length === 1 ? '' : 's'}
          </span>
          {shortcut && (
            <kbd
              className="ml-auto rounded border px-1.5 py-0.5 text-[0.6rem]"
              style={{ borderColor: theme.colors.border, color: theme.colors.muted }}
            >
              {shortcut}
            </kbd>
          )}
        </div>
      </div>

      {/* Hover wash in the card's own accent */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120% 80% at 50% 0%, ${theme.colors.primary}1f, transparent 60%)`,
        }}
        aria-hidden="true"
      />
    </motion.button>
  );
}
