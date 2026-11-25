import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CloudOff,
  Copy,
  Download,
  Eye,
  EyeOff,
  ImageOff,
  Bot,
  ImagePlus,
  KeyRound,
  Link2,
  LockKeyhole,
  LogIn,
  LogOut,
  Play,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { IconButton } from '@/components/ui/IconButton';
import { Switch } from '@/components/ui/Switch';
import { useVibe } from '@/state/vibe-context';
import { useToast } from '@/state/toast-context';
import { useSync, type SyncStatus } from '@/state/sync-context';
import { backgroundStillFor, safeCustomImage } from '@/themes/backgrounds';
import {
  COLOR_KEYS,
  EFFECT_KEYS,
  HEADING_FONTS,
  MAX_IMAGE_LENGTH,
  MODE_ICONS,
  TEXT_LIMITS,
  UPLOADED,
  isAddedMode,
  isHidden,
  pairsToLines,
  type FontKey,
  type IconKey,
} from '@/themes/customize';
import { PASSWORD_LENGTH, USERNAME_PATTERN } from '@/themes/limits';
import type { VibeColors, VibeEffects, VibePlaylist } from '@/types/theme';
import { cn } from '@/utils/cn';
import { downloadJson } from '@/utils/backup';

const COLOR_LABELS: Record<keyof VibeColors, string> = {
  primary: 'Main',
  accent: 'Highlight',
  background: 'Background',
  text: 'Text',
  secondary: 'Secondary',
  backgroundAlt: 'Background 2',
  surface: 'Panels',
  muted: 'Soft text',
  border: 'Lines',
  glow: 'Glow',
};

const EFFECT_LABELS: Record<keyof VibeEffects, string> = {
  grain: 'Film grain',
  vignette: 'Vignette',
  scanlines: 'Scanlines',
  dust: 'Dust',
  haze: 'Haze',
  daylight: 'Daylight',
};

/** The four colours most people mean by "change the colours"; the rest fold away. */
const MAIN_COLORS = COLOR_KEYS.slice(0, 4);
const MORE_COLORS = COLOR_KEYS.slice(4);

const INPUT =
  'w-full min-w-0 rounded-lg border border-line bg-canvas/60 px-3 py-2 text-base text-ink placeholder:text-muted/60 focus-visible:border-primary/60 sm:text-sm';

const SMALL_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-primary/50 disabled:pointer-events-none disabled:opacity-40';

/**
 * Shrinks an uploaded picture to a background-sized still and returns it as a
 * data URL that fits in localStorage — a phone photo straight off the camera
 * would blow the quota on its own.
 */
async function encodeUpload(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Safari cannot encode WebP and quietly returns a PNG instead — several MB
  // at this size — so it gets a JPEG.
  const webp = canvas.toDataURL('image/webp', 0.8);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.82);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line/60 pt-4">
      <h3 className="vm-label text-muted">{title}</h3>
      {children}
    </section>
  );
}

/**
 * A destructive button that asks twice: the first press arms it for a few
 * seconds, the second does it. Cheaper and calmer than a confirm dialog, and
 * it can't be dismissed on autopilot.
 */
function ConfirmButton({
  label,
  confirmLabel,
  icon,
  onConfirm,
  disabled,
  className,
}: {
  label: string;
  confirmLabel: string;
  icon: ReactNode;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(id);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      disabled={disabled}
      aria-label={armed ? confirmLabel : label}
      className={cn(SMALL_BUTTON, className, armed && 'border-primary/70 bg-primary/15 text-primary')}
    >
      {icon}
      {armed ? confirmLabel : label}
    </button>
  );
}

interface CustomizePanelProps {
  open: boolean;
  onClose: () => void;
}

export function CustomizePanel({ open, onClose }: CustomizePanelProps) {
  const {
    allThemes,
    deletedThemes,
    theme,
    customization,
    editMode,
    resetMode,
    addMode,
    removeMode,
    moveMode,
    selectTheme,
    exportSettings,
    exportMode,
    importSettings,
    setUpload,
  } = useVibe();
  const { push } = useToast();

  const [selectedId, setSelectedId] = useState(theme.id);
  // Opening the panel starts on the mode you are in, so edits preview live.
  useEffect(() => {
    if (open) setSelectedId(theme.id);
  }, [open, theme.id]);

  const index = Math.max(
    0,
    allThemes.findIndex((item) => item.id === selectedId),
  );
  const mode = allThemes[index] ?? theme;
  const edit = customization.edits[mode.id] ?? {};
  const added = isAddedMode(mode.id);
  const hidden = isHidden(customization, mode.id);
  const visibleCount = allThemes.filter((item) => !isHidden(customization, item.id)).length;
  const Icon = mode.icon;

  const [imageDraft, setImageDraft] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const current = customization.edits[mode.id]?.image;
    // Only a link the visitor typed goes back in the field, never an upload.
    const typed = typeof current === 'string' && current !== UPLOADED && !current.startsWith('data:');
    setImageDraft(typed ? current : '');
    setImageError(null);
  }, [mode.id, customization.edits]);

  const preview = backgroundStillFor(mode);
  const imageState =
    edit.image === undefined
      ? 'Default picture'
      : edit.image === null
        ? 'No picture — colour gradient'
        : edit.image === UPLOADED || edit.image.startsWith('data:')
          ? 'Your uploaded picture'
          : 'Your linked picture';

  const applyImageUrl = () => {
    const url = safeCustomImage(imageDraft);
    if (!url) {
      setImageError('That isn’t a link to a picture. Use a full https:// address.');
      return;
    }
    editMode(mode.id, { image: url });
    push('Background updated.', 'CUSTOMIZE');
  };

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await encodeUpload(file);
      if (data.length > MAX_IMAGE_LENGTH || !setUpload(mode.id, data)) {
        setImageError('No room left to save that picture here. Remove another uploaded one first.');
        return;
      }
      setImageError(null);
      push('Picture saved to this mode.', 'CUSTOMIZE');
    } catch {
      setImageError('Couldn’t read that file as a picture. Try a JPG, PNG or WebP.');
    }
  };

  const shareMode = () => {
    const shared = exportMode(mode.id);
    if (!shared) return;
    const slug = mode.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mode';
    downloadJson(shared, `${slug}.vibe-mode.json`);
    push(`Saved “${mode.name}” as a file. Send it — they add it with “Restore from file”.`, 'SHARE');
  };

  const restoreFromFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = importSettings(JSON.parse(await file.text()));
      if (result?.kind === 'mode') {
        setSelectedId(result.id);
        push(
          result.pictureDropped
            ? 'Mode added from the file, without its picture — no room left. Remove another uploaded picture, then add it again.'
            : 'Mode added from the file — find it at the end of the list.',
          'IMPORT',
        );
        return;
      }
      if (result?.kind === 'backup') {
        push('Settings restored from your file.', 'IMPORT');
        return;
      }
    } catch {
      /* falls through to the message below */
    }
    push('That file isn’t a Vibe Mode backup or shared mode.', 'IMPORT');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Customize"
      description="Make every mode yours. Changes save as you go — here and in the cloud."
    >
      <div className="grid gap-5 sm:grid-cols-[12.5rem_1fr]">
        {/* ── Every mode, hidden ones included ─────────────────────────── */}
        <nav aria-label="Modes" className="flex min-w-0 flex-col gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-canvas transition-[filter] hover:brightness-110"
            onClick={() => {
              const id = addMode(theme.id, true);
              if (!id) return;
              setSelectedId(id);
              push('New mode added. Give it a name, a picture and some music.', 'CUSTOMIZE');
            }}
          >
            <Plus className="size-4" />
            New mode
          </button>
          <ul className="flex flex-wrap gap-1.5 sm:flex-col sm:flex-nowrap">
            {allThemes.map((item) => {
              const ItemIcon = item.icon;
              const itemHidden = isHidden(customization, item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-current={item.id === mode.id ? 'true' : undefined}
                    className={cn(
                      'flex w-full min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors',
                      item.id === mode.id
                        ? 'border-primary/60 bg-primary/12 text-ink'
                        : 'border-transparent text-muted hover:bg-ink/6 hover:text-ink',
                      itemHidden && 'opacity-55',
                    )}
                  >
                    <ItemIcon className="size-4 shrink-0" style={{ color: item.colors.primary }} />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {itemHidden && <EyeOff className="size-3.5 shrink-0" aria-label="hidden" />}
                    {isAddedMode(item.id) && (
                      <span className="vm-label shrink-0 text-[0.6rem] text-accent">yours</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {deletedThemes.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-line/60 pt-3">
              <p className="vm-label text-muted">Deleted</p>
              <ul className="flex flex-col gap-1">
                {deletedThemes.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 px-1 text-sm text-muted">
                    <span className="min-w-0 flex-1 truncate line-through">{item.name}</span>
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-ink hover:bg-ink/8"
                      onClick={() => {
                        editMode(item.id, { deleted: false });
                        setSelectedId(item.id);
                        push(`${item.name} is back.`, 'CUSTOMIZE');
                      }}
                    >
                      <Undo2 className="size-3.5" />
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        {/* ── Editor for the selected mode ─────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="size-5 shrink-0" style={{ color: mode.colors.primary }} />
            <h3 className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-ink">
              {mode.name}
            </h3>
            <IconButton label="Move up" size="sm" variant="outline" disabled={index === 0} onClick={() => moveMode(mode.id, -1)}>
              <ArrowUp />
            </IconButton>
            <IconButton
              label="Move down"
              size="sm"
              variant="outline"
              disabled={index === allThemes.length - 1}
              onClick={() => moveMode(mode.id, 1)}
            >
              <ArrowDown />
            </IconButton>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SMALL_BUTTON}
              // The last visible mode can't go — the picker would be empty.
              disabled={!hidden && visibleCount <= 1}
              onClick={() => editMode(mode.id, { hidden: !hidden })}
            >
              {hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              {hidden ? 'Show in picker' : 'Hide from picker'}
            </button>
            <button
              type="button"
              className={SMALL_BUTTON}
              onClick={() => {
                const id = addMode(mode.id);
                if (!id) return;
                setSelectedId(id);
                push(`New mode added — a copy of ${mode.name}.`, 'CUSTOMIZE');
              }}
            >
              <Copy className="size-3.5" />
              Make a copy
            </button>
            <button type="button" className={SMALL_BUTTON} onClick={shareMode}>
              <Share2 className="size-3.5" />
              Share
            </button>
            <ConfirmButton
              label="Reset"
              confirmLabel="Sure? Reset"
              icon={<RotateCcw className="size-3.5" />}
              onConfirm={() => {
                resetMode(mode.id);
                push(
                  added ? `Your changes to ${mode.name} undone.` : `${mode.name} is back to how it ships.`,
                  'CUSTOMIZE',
                );
              }}
            />
            <ConfirmButton
              label="Delete"
              confirmLabel="Sure? Delete"
              icon={<Trash2 className="size-3.5" />}
              // The last visible mode can't go — there'd be nowhere to be.
              disabled={!hidden && visibleCount <= 1}
              onConfirm={() => {
                removeMode(mode.id);
                setSelectedId(theme.id);
                push(
                  added
                    ? `“${mode.name}” deleted.`
                    : `“${mode.name}” deleted. Restore it from the list any time.`,
                  'CUSTOMIZE',
                );
              }}
            />
            {/* Last, so the buttons before it don't jump when it comes and goes. */}
            {mode.id !== theme.id && (
              <button type="button" className={SMALL_BUTTON} onClick={() => selectTheme(mode.id)}>
                <Play className="size-3.5" />
                Switch to it
              </button>
            )}
          </div>

          <Section title="Words">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input
                  className={INPUT}
                  maxLength={TEXT_LIMITS.name}
                  value={edit.name ?? mode.name}
                  onChange={(event) => editMode(mode.id, { name: event.target.value })}
                />
              </Field>
              <Field label="Short name (top bar)">
                <input
                  className={INPUT}
                  maxLength={TEXT_LIMITS.shortName}
                  value={edit.shortName ?? mode.shortName}
                  onChange={(event) => editMode(mode.id, { shortName: event.target.value })}
                />
              </Field>
              <Field label="Status line (above the name)">
                <input
                  className={INPUT}
                  maxLength={TEXT_LIMITS.kicker}
                  value={edit.kicker ?? mode.hero.kicker}
                  onChange={(event) => editMode(mode.id, { kicker: event.target.value })}
                />
              </Field>
              <Field label="Card description">
                <input
                  className={INPUT}
                  maxLength={TEXT_LIMITS.description}
                  value={edit.description ?? mode.description}
                  onChange={(event) => editMode(mode.id, { description: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Quotes — one per line">
              <textarea
                className={cn(INPUT, 'min-h-28 resize-y leading-relaxed')}
                value={edit.quotes?.join('\n') ?? mode.quotes.join('\n')}
                onChange={(event) => editMode(mode.id, { quotes: event.target.value.split('\n') })}
              />
            </Field>
            <p className="text-xs text-muted">
              Anything can be emptied except the name, which goes back to the original when cleared.
              Reset brings everything back.
            </p>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Icon</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Icon">
                {(Object.keys(MODE_ICONS) as IconKey[]).map((key) => {
                  const Choice = MODE_ICONS[key];
                  const on = Choice === mode.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={key}
                      aria-pressed={on}
                      onClick={() => editMode(mode.id, { icon: key })}
                      className={cn(
                        'vm-tap grid size-9 place-items-center rounded-lg border transition-colors',
                        on ? 'border-primary/70 bg-primary/15' : 'border-line/60 hover:border-primary/40',
                      )}
                    >
                      <Choice className="size-4" style={{ color: on ? mode.colors.primary : undefined }} />
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Heading font">
              <select
                className={INPUT}
                value={edit.headingFont ?? ''}
                onChange={(event) =>
                  editMode(mode.id, { headingFont: (event.target.value || undefined) as FontKey | undefined })
                }
              >
                <option value="">Original</option>
                {(Object.keys(HEADING_FONTS) as FontKey[]).map((key) => (
                  <option key={key} value={key}>
                    {HEADING_FONTS[key].label}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <PlaylistEditor modeId={mode.id} />


          <Section title="Background">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div
                className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg border border-line sm:w-40"
                style={{ background: mode.background.gradient ?? mode.colors.backgroundAlt }}
              >
                {preview && (
                  <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-xs text-muted">{imageState}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={SMALL_BUTTON} onClick={() => uploadRef.current?.click()}>
                    <ImagePlus className="size-3.5" />
                    Upload a picture
                  </button>
                  <button
                    type="button"
                    className={SMALL_BUTTON}
                    disabled={edit.image === null}
                    onClick={() => editMode(mode.id, { image: null })}
                  >
                    <ImageOff className="size-3.5" />
                    No picture
                  </button>
                  <button
                    type="button"
                    className={SMALL_BUTTON}
                    disabled={edit.image === undefined}
                    onClick={() => editMode(mode.id, { image: undefined })}
                  >
                    <RotateCcw className="size-3.5" />
                    Default
                  </button>
                </div>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(event) => {
                    void uploadImage(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
                <div className="flex gap-2">
                  <input
                    className={cn(INPUT, 'font-mono')}
                    type="url"
                    inputMode="url"
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="Picture or video link"
                    placeholder="…or paste a picture / video link"
                    value={imageDraft}
                    aria-invalid={imageError !== null}
                    onChange={(event) => {
                      setImageDraft(event.target.value);
                      setImageError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyImageUrl();
                    }}
                  />
                  <button
                    type="button"
                    className={cn(SMALL_BUTTON, 'shrink-0')}
                    disabled={!imageDraft.trim()}
                    onClick={applyImageUrl}
                  >
                    <Link2 className="size-3.5" />
                    Use
                  </button>
                </div>
                {imageError && (
                  <p role="alert" className="flex items-center gap-1.5 text-xs text-primary">
                    <TriangleAlert className="size-3.5 shrink-0" />
                    {imageError}
                  </p>
                )}
              </div>
            </div>
          </Section>

          <Section title="Colours">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MAIN_COLORS.map((key) => (
                <ColorField
                  key={key}
                  label={COLOR_LABELS[key]}
                  value={mode.colors[key]}
                  onChange={(value) => editMode(mode.id, { colors: { [key]: value } })}
                />
              ))}
            </div>
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">
                All colours
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {MORE_COLORS.map((key) => (
                  <ColorField
                    key={key}
                    label={COLOR_LABELS[key]}
                    value={mode.colors[key]}
                    onChange={(value) => editMode(mode.id, { colors: { [key]: value } })}
                  />
                ))}
              </div>
            </details>
          </Section>

          <Section title="Atmosphere layers">
            <div className="flex flex-wrap gap-2">
              {EFFECT_KEYS.map((key) => {
                const on = Boolean(mode.effects?.[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => editMode(mode.id, { effects: { ...mode.effects, [key]: !on } })}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      on
                        ? 'border-primary/60 bg-primary/15 text-ink'
                        : 'border-line text-muted hover:text-ink',
                    )}
                  >
                    {EFFECT_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Status readouts">
            <p className="text-xs text-muted">
              Shown when “Status readouts” is on in Settings. One per line; panel and bar lines are{' '}
              <code className="font-mono">Label: value</code>.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Stats panel">
                <textarea
                  className={cn(INPUT, 'min-h-24 resize-y font-mono')}
                  value={edit.stats?.join('\n') ?? pairsToLines(mode.stats)}
                  onChange={(event) => editMode(mode.id, { stats: event.target.value.split('\n') })}
                />
              </Field>
              <Field label="Status bar">
                <textarea
                  className={cn(INPUT, 'min-h-24 resize-y font-mono')}
                  value={edit.hud?.join('\n') ?? pairsToLines(mode.hud)}
                  onChange={(event) => editMode(mode.id, { hud: event.target.value.split('\n') })}
                />
              </Field>
            </div>
            <Field label="Ticker lines">
              <textarea
                className={cn(INPUT, 'min-h-20 resize-y font-mono')}
                value={edit.ticker?.join('\n') ?? (mode.ticker ?? []).join('\n')}
                onChange={(event) => editMode(mode.id, { ticker: event.target.value.split('\n') })}
              />
            </Field>
          </Section>
        </div>
      </div>

      <CloudSection />

      {/* ── Backup ─────────────────────────────────────────────────────── */}
      <section className="mt-6 flex flex-col gap-2 border-t border-line/60 pt-4">
        <h3 className="vm-label text-muted">Backup</h3>
        <p className="text-xs text-muted">
          Everything you changed — modes, pictures, settings, your playlists — in one file. Use it
          to move to another browser or device, or to undo an experiment. “Restore from file” also
          takes a mode someone shared with you, and adds it without touching yours.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => downloadJson(exportSettings(), 'vibe-mode-settings.json')}
          >
            <Download className="size-3.5" />
            Download my settings
          </button>
          <button type="button" className={SMALL_BUTTON} onClick={() => importRef.current?.click()}>
            <Upload className="size-3.5" />
            Restore from file
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              void restoreFromFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
      </section>
    </Modal>
  );
}

const SYNC_STATUS: Record<Exclude<SyncStatus, 'saved'>, string> = {
  idle: 'Nothing saved to the cloud yet — that starts with your first change.',
  saving: 'Saving…',
  offline: 'Offline. Your changes are kept here and saved when you’re back.',
  error: 'The last save didn’t go through.',
  off: 'Cloud save is off. Your changes stay in this browser only.',
};

/**
 * Username + password, for setting one or signing in with it. A real <form>
 * with the standard autocomplete names, so password managers offer to save
 * and fill it. Lowercased as typed: usernames are case-insensitive anyway.
 */
function PasswordForm({
  purpose,
  username: initial,
  busy,
  onSubmit,
}: {
  purpose: 'set' | 'sign-in';
  username: string | null;
  busy: boolean;
  onSubmit: (username: string, password: string) => Promise<unknown>;
}) {
  const [username, setUsername] = useState(initial ?? '');
  const [password, setPassword] = useState('');
  // Its own flag, not the section's `busy`: the password is stretched in the
  // browser first (up to a second on a slow phone), so the button says so.
  const [pending, setPending] = useState(false);
  const setting = purpose === 'set';
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault(); // inside a <dialog>: never navigate or close it
        setPending(true);
        void onSubmit(username, password).finally(() => setPending(false));
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Username">
          <input
            className={INPUT}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            pattern={USERNAME_PATTERN}
            title="3 to 30 letters, numbers, dashes or underscores"
            value={username}
            onChange={(event) => setUsername(event.currentTarget.value.toLowerCase())}
          />
        </Field>
        <Field label={setting ? `New password (at least ${PASSWORD_LENGTH.min} characters)` : 'Password'}>
          <input
            className={INPUT}
            type="password"
            name="password"
            autoComplete={setting ? 'new-password' : 'current-password'}
            required
            minLength={setting ? PASSWORD_LENGTH.min : undefined}
            maxLength={PASSWORD_LENGTH.max}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={SMALL_BUTTON} disabled={busy}>
          {setting ? <LockKeyhole className="size-3.5" /> : <LogIn className="size-3.5" />}
          {pending
            ? setting
              ? 'Saving…'
              : 'Signing in…'
            : setting
              ? 'Save username & password'
              : 'Sign in'}
        </button>
        <p className="text-xs text-muted">
          {!setting
            ? 'Replaces this browser’s modes with that account’s.'
            : initial
              ? 'Changing it signs out your other devices and AI assistant links.'
              : 'There’s no email, so a forgotten password can’t be reset — keep a passkey or another device too.'}
        </p>
      </div>
    </form>
  );
}

/**
 * Cloud save (phase 2), sync links (phase 3), passkeys (phase 4) and the
 * optional username + password — see `state/SyncProvider.tsx`. No sign-up:
 * changes save on their own, and these controls only matter for a second
 * device or a lost browser.
 */
function CloudSection() {
  const sync = useSync();
  const { push } = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [mcpLink, setMcpLink] = useState<string | null>(null);
  const [incoming, setIncoming] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<'set' | 'sign-in' | null>(null);
  // Asked only when the panel opens with a cloud copy — not on every page load.
  const [login, setLogin] = useState<string | null>(null);
  const { hasKey, loginName } = sync;
  useEffect(() => {
    if (hasKey) void loginName().then(setLogin);
    else setLogin(null);
  }, [hasKey, loginName]);

  const run = (task: () => Promise<unknown>) => {
    setBusy(true);
    return task().finally(() => setBusy(false));
  };

  const status =
    sync.status === 'saved'
      ? `Saved to the cloud${
          sync.savedAt
            ? ` · ${new Date(sync.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : ''
        }.`
      : SYNC_STATUS[sync.status];

  return (
    <section className="mt-6 flex flex-col gap-3 border-t border-line/60 pt-4">
      <h3 className="vm-label text-muted">Cloud save &amp; your devices</h3>
      <p className="text-xs text-muted">
        What you change here saves itself — no sign-up needed. Come back on this browser and
        it’s all still here. <span className="text-ink">{status}</span>
        {login && (
          <>
            {' '}
            Signed in as <span className="text-ink">{login}</span>.
          </>
        )}
      </p>
      {sync.message && (
        <p className="text-xs text-primary" role="status">
          {sync.message}
        </p>
      )}

      {sync.status === 'off' ? (
        <div>
          <button type="button" className={SMALL_BUTTON} onClick={sync.turnOn}>
            Turn cloud save back on
          </button>
        </div>
      ) : (
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
          <button
            type="button"
            className={SMALL_BUTTON}
            disabled={busy}
            onClick={() => run(async () => setMcpLink(await sync.connectAssistant()))}
          >
            <Bot className="size-3.5" />
            Connect an AI assistant
          </button>
          {sync.passkeysSupported && (
            <button
              type="button"
              className={SMALL_BUTTON}
              disabled={busy}
              onClick={() => run(sync.addPasskey)}
            >
              <KeyRound className="size-3.5" />
              Add a passkey
            </button>
          )}
          <button
            type="button"
            className={SMALL_BUTTON}
            disabled={busy}
            aria-expanded={form === 'set'}
            onClick={() => setForm(form === 'set' ? null : 'set')}
          >
            <LockKeyhole className="size-3.5" />
            {login ? 'Change password' : 'Set a username & password'}
          </button>
        </div>
      )}

      {form === 'set' && sync.status !== 'off' && (
        <div className="flex flex-col gap-2">
          <PasswordForm
            purpose="set"
            username={login}
            busy={busy}
            onSubmit={(username, password) =>
              run(async () => {
                if (!(await sync.setPassword(username, password))) return;
                setLogin(username);
                setForm(null);
              })
            }
          />
          {login && (
            <div>
              <ConfirmButton
                label="Remove password sign-in"
                confirmLabel="Sure? Remove it"
                icon={<Trash2 className="size-3.5" />}
                disabled={busy}
                onConfirm={() =>
                  run(async () => {
                    if (!(await sync.removePassword())) return;
                    setLogin(null);
                    setForm(null);
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      {link && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              readOnly
              aria-label="Link for your other device"
              className={cn(INPUT, 'font-mono text-xs sm:text-xs')}
              value={link}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className={SMALL_BUTTON}
              onClick={() =>
                void navigator.clipboard
                  .writeText(link)
                  .then(() => push('Link copied. Open it on your other device.', 'SYNC'))
                  .catch(() => push('Couldn’t copy — select the link and copy it by hand.', 'SYNC'))
              }
            >
              <Copy className="size-3.5" />
              Copy
            </button>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <TriangleAlert className="mt-px size-3.5 shrink-0 text-primary" />
            Anyone with this link can see and change your modes. Send it only to yourself. If it
            ends up somewhere else, use “Sign out other devices”.
          </p>
        </div>
      )}

      {mcpLink && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              readOnly
              aria-label="MCP server link for your AI assistant"
              className={cn(INPUT, 'font-mono text-xs sm:text-xs')}
              value={mcpLink}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className={SMALL_BUTTON}
              onClick={() =>
                void navigator.clipboard
                  .writeText(mcpLink)
                  .then(() => push('MCP link copied. Add it as a connector in your AI app.', 'AI'))
                  .catch(() => push('Couldn’t copy — select the link and copy it by hand.', 'AI'))
              }
            >
              <Copy className="size-3.5" />
              Copy
            </button>
          </div>
          <p className="text-xs text-muted">
            Add it as a custom connector (remote MCP server, no sign-in) in Claude, ChatGPT or Gemini.
            The assistant can then change your modes and playlists. Like a sync link, it grants full
            access — “Sign out other devices” revokes it.
          </p>
        </div>
      )}

      {sync.hasKey && (
        <Switch
          checked={sync.remoteControl}
          onChange={sync.setRemoteControl}
          label="Let AI control this tab"
          description="Your assistant can play, pause, skip, switch mode and change the volume here. Checks every few seconds while on."
        />
      )}

      <Field label="Got a link from your other device?">
        <div className="flex gap-2">
          <input
            className={INPUT}
            value={incoming}
            placeholder="Paste the sync link"
            onChange={(event) => setIncoming(event.target.value)}
          />
          <ConfirmButton
            label="Use it"
            confirmLabel="Replace mine?"
            icon={<Check className="size-3.5" />}
            className="shrink-0 whitespace-nowrap"
            disabled={busy || !incoming.trim()}
            onConfirm={() =>
              run(async () => {
                if (await sync.adoptLink(incoming)) setIncoming('');
              })
            }
          />
        </div>
      </Field>

      <div className="flex flex-wrap gap-2">
        {sync.passkeysSupported && (
          <ConfirmButton
            label="Sign in with a passkey"
            confirmLabel="Sure? Replaces this browser’s modes"
            icon={<KeyRound className="size-3.5" />}
            disabled={busy}
            onConfirm={() => run(sync.signInWithPasskey)}
          />
        )}
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={busy}
          aria-expanded={form === 'sign-in'}
          onClick={() => setForm(form === 'sign-in' ? null : 'sign-in')}
        >
          <LogIn className="size-3.5" />
          Sign in with a password
        </button>
        {sync.hasKey && (
          <>
            <ConfirmButton
              label="Sign out other devices"
              confirmLabel="Sure? Sign them out"
              icon={<LogOut className="size-3.5" />}
              disabled={busy}
              onConfirm={() => run(sync.signOutOtherDevices)}
            />
            <ConfirmButton
              label="Delete my cloud copy"
              confirmLabel="Sure? Delete for good"
              icon={<CloudOff className="size-3.5" />}
              disabled={busy}
              onConfirm={() => run(sync.deleteCloudCopy)}
            />
          </>
        )}
      </div>

      {form === 'sign-in' && (
        <PasswordForm
          purpose="sign-in"
          username={null}
          busy={busy}
          onSubmit={(username, password) =>
            run(async () => {
              if (!(await sync.signInWithPassword(username, password))) return;
              setForm(null);
              setLogin(await sync.loginName());
            })
          }
        />
      )}
    </section>
  );
}

/**
 * Every playlist in one mode — the ones it ships with and the listener's own —
 * each renamable, relinkable and removable, plus a form to add as many more
 * as they like. Works on any mode, not just the one playing.
 */
function PlaylistEditor({ modeId }: { modeId: string }) {
  const { allThemes, customization, editMode, addCustomPlaylist } = useVibe();
  const { push } = useToast();
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [invalid, setInvalid] = useState(false);

  const mode = allThemes.find((item) => item.id === modeId);
  if (!mode) return null;
  const removedCount = customization.edits[modeId]?.removedPlaylists?.length ?? 0;
  // In a mode the listener made, those playlists were never theirs to "bring
  // back" — they belong to the mode it was built from, so say so.
  const baseName = mode.baseId ? allThemes.find((item) => item.id === mode.baseId)?.name : undefined;
  const plural = removedCount === 1 ? '' : 's';

  const add = () => {
    if (!addCustomPlaylist(name, link, modeId)) {
      setInvalid(true);
      return;
    }
    push(`“${name.trim() || 'My playlist'}” added to ${mode.name}.`, 'PLAYLIST');
    setName('');
    setLink('');
    setInvalid(false);
  };

  return (
    <Section title={`Playlists · ${mode.playlists.length}`}>
      {mode.playlists.length === 0 ? (
        <p className="text-xs text-muted">No playlists in this mode yet — add one below.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mode.playlists.map((playlist) => (
            <PlaylistRow key={`${modeId}:${playlist.id}`} modeId={modeId} playlist={playlist} />
          ))}
        </ul>
      )}

      {removedCount > 0 && (
        <button
          type="button"
          className={cn(SMALL_BUTTON, 'self-start')}
          onClick={() => editMode(modeId, { removedPlaylists: [] })}
        >
          <Undo2 className="size-3.5" />
          {baseName
            ? `Add the ${removedCount} playlist${plural} from ${baseName}`
            : `Bring back ${removedCount} removed playlist${plural}`}
        </button>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line p-3">
        <p className="text-xs font-medium text-ink">Add a playlist</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={cn(INPUT, 'sm:w-44')}
            aria-label="New playlist name"
            placeholder="Name — e.g. Late night drive"
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') add();
            }}
          />
          <input
            className={cn(INPUT, 'font-mono')}
            aria-label="New playlist link"
            aria-invalid={invalid}
            inputMode="url"
            spellCheck={false}
            autoComplete="off"
            placeholder="YouTube playlist link, or video links with commas"
            value={link}
            onChange={(event) => {
              setLink(event.target.value);
              setInvalid(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') add();
            }}
          />
          <button
            type="button"
            className={cn(SMALL_BUTTON, 'shrink-0 justify-center border-primary/60 bg-primary text-canvas hover:brightness-110')}
            disabled={!link.trim()}
            onClick={add}
          >
            <Plus className="size-3.5" />
            Add
          </button>
        </div>
        {invalid && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-primary">
            <TriangleAlert className="size-3.5 shrink-0" />
            Couldn’t find a playlist or video in that. Paste the full YouTube link.
          </p>
        )}
      </div>
    </Section>
  );
}

function PlaylistRow({ modeId, playlist }: { modeId: string; playlist: VibePlaylist }) {
  const { theme, playlistId, selectPlaylist, customization, updatePlaylist, removePlaylist, isCustomPlaylist } =
    useVibe();
  const { push } = useToast();
  const own = isCustomPlaylist(playlist.id);
  const currentLink = playlist.youtubePlaylistId ?? playlist.videoIds?.join(',') ?? '';
  const relinked = !own && Boolean(customization.edits[modeId]?.playlistSources?.[playlist.id]);

  // Drafts, committed on blur / Enter / Save — writing every keystroke would
  // also try to save half a link, and an emptied name would snap back mid-edit.
  const [name, setName] = useState(playlist.name);
  const [link, setLink] = useState(currentLink);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setName(playlist.name), [playlist.name]);
  useEffect(() => {
    setLink(currentLink);
    setInvalid(false);
  }, [currentLink]);

  const saveName = () => {
    if (name.trim() === playlist.name) return;
    // An emptied name goes back to the original (built-in) or stays as it was (yours).
    if (!name.trim() && own) return setName(playlist.name);
    updatePlaylist(modeId, playlist.id, { name: name.trim() });
  };

  const saveLink = () => {
    if (link.trim() === currentLink) return;
    if (!updatePlaylist(modeId, playlist.id, { source: link })) {
      setInvalid(true);
      return;
    }
    push(link.trim() ? `“${playlist.name}” now plays your link.` : `“${playlist.name}” is back to its default.`, 'PLAYLIST');
  };

  const playing = modeId === theme.id && playlistId === playlist.id;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line/60 bg-canvas/40 p-2.5">
      <div className="flex items-center gap-2">
        <input
          className={cn(INPUT, 'font-medium')}
          aria-label="Playlist name"
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') saveName();
          }}
        />
        {modeId === theme.id && (
          <button
            type="button"
            className={cn(SMALL_BUTTON, 'shrink-0', playing && 'border-primary/60 text-primary')}
            aria-pressed={playing}
            onClick={() => selectPlaylist(playlist.id)}
          >
            <Play className="size-3.5" />
            {playing ? 'Playing' : 'Play'}
          </button>
        )}
        <ConfirmButton
          label="Remove"
          confirmLabel="Sure?"
          icon={<Trash2 className="size-3.5" />}
          className="shrink-0"
          onConfirm={() => {
            removePlaylist(modeId, playlist.id);
            push(`“${playlist.name}” removed.`, 'PLAYLIST');
          }}
        />
      </div>
      <div className="flex gap-2">
        <input
          className={cn(INPUT, 'font-mono')}
          aria-label={`Link for ${playlist.name}`}
          aria-invalid={invalid}
          inputMode="url"
          spellCheck={false}
          autoComplete="off"
          placeholder={own ? 'Playlist or video links' : 'Empty = the default link'}
          value={link}
          onChange={(event) => {
            setLink(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') saveLink();
          }}
        />
        <button
          type="button"
          className={cn(SMALL_BUTTON, 'shrink-0')}
          disabled={link.trim() === currentLink}
          onClick={saveLink}
        >
          <Check className="size-3.5" />
          Save
        </button>
      </div>
      <p className="text-xs text-muted">
        {own ? 'Yours' : relinked ? 'Built-in · playing your link' : 'Built-in · default link'}
      </p>
      {invalid && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-primary">
          <TriangleAlert className="size-3.5 shrink-0" />
          {own && !link.trim()
            ? 'Your own playlist needs a link — or remove it.'
            : 'Couldn’t find a playlist or video in that. Paste the full YouTube link.'}
        </p>
      )}
    </li>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line/70 bg-canvas/40 p-1.5 pr-2.5">
      {/* Native picker: free keyboard + screen-reader support, and always #rrggbb. */}
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="size-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium text-ink">{label}</span>
        <span className="font-mono text-[0.65rem] text-muted uppercase">{value}</span>
      </span>
    </label>
  );
}
