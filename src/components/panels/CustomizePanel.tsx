import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  ImageOff,
  ImagePlus,
  Link2,
  Play,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { IconButton } from '@/components/ui/IconButton';
import { useVibe } from '@/state/vibe-context';
import { useToast } from '@/state/toast-context';
import { backgroundStillFor, safeCustomImage } from '@/themes/backgrounds';
import {
  COLOR_KEYS,
  EFFECT_KEYS,
  MAX_IMAGE_LENGTH,
  TEXT_LIMITS,
  isAddedMode,
  isHidden,
} from '@/themes/customize';
import type { VibeColors, VibeEffects } from '@/types/theme';
import { cn } from '@/utils/cn';

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

/**
 * Browsers give a site ~5 MB of localStorage, and a write over quota is
 * dropped silently — which here would lose every edit since. Uploads are the
 * only thing big enough to get near it, so they are checked against this.
 */
const STORAGE_BUDGET = 4_000_000;

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
}: {
  label: string;
  confirmLabel: string;
  icon: ReactNode;
  onConfirm: () => void;
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
      className={cn(SMALL_BUTTON, armed && 'border-primary/70 bg-primary/15 text-primary')}
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
    theme,
    customization,
    editMode,
    resetMode,
    addMode,
    removeMode,
    moveMode,
    selectTheme,
    exportSettings,
    importSettings,
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
    setImageDraft(typeof current === 'string' && !current.startsWith('data:') ? current : '');
    setImageError(null);
  }, [mode.id, customization.edits]);

  const preview = backgroundStillFor(mode);
  const imageState =
    edit.image === undefined
      ? 'Default picture'
      : edit.image === null
        ? 'No picture — colour gradient'
        : edit.image.startsWith('data:')
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
      const others = JSON.stringify(customization).length - (edit.image?.length ?? 0);
      if (data.length > MAX_IMAGE_LENGTH || others + data.length > STORAGE_BUDGET) {
        setImageError('No room left to save that picture here. Remove another uploaded one first.');
        return;
      }
      editMode(mode.id, { image: data });
      setImageError(null);
      push('Picture saved to this mode.', 'CUSTOMIZE');
    } catch {
      setImageError('Couldn’t read that file as a picture. Try a JPG, PNG or WebP.');
    }
  };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(exportSettings(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vibe-mode-settings.json';
    link.click();
    // Revoking in the same tick can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const restoreBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (importSettings(JSON.parse(await file.text()))) {
        push('Settings restored from your file.', 'IMPORT');
        return;
      }
    } catch {
      /* falls through to the message below */
    }
    push('That file isn’t a Vibe Mode settings backup.', 'IMPORT');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Customize"
      description="Make every mode yours. Changes save in this browser as you go."
    >
      <div className="grid gap-5 sm:grid-cols-[12.5rem_1fr]">
        {/* ── Every mode, hidden ones included ─────────────────────────── */}
        <nav aria-label="Modes" className="flex min-w-0 flex-col gap-2">
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
            {added ? (
              <ConfirmButton
                label="Delete"
                confirmLabel="Sure? Delete"
                icon={<Trash2 className="size-3.5" />}
                onConfirm={() => {
                  removeMode(mode.id);
                  setSelectedId(theme.id);
                  push(`“${mode.name}” deleted.`, 'CUSTOMIZE');
                }}
              />
            ) : (
              <ConfirmButton
                label="Reset"
                confirmLabel="Sure? Reset"
                icon={<RotateCcw className="size-3.5" />}
                onConfirm={() => {
                  resetMode(mode.id);
                  push(`${mode.name} is back to how it ships.`, 'CUSTOMIZE');
                }}
              />
            )}
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
            <p className="text-xs text-muted">Clear a field to get the original back.</p>
          </Section>

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
        </div>
      </div>

      {/* ── Backup ─────────────────────────────────────────────────────── */}
      <section className="mt-6 flex flex-col gap-2 border-t border-line/60 pt-4">
        <h3 className="vm-label text-muted">Backup</h3>
        <p className="text-xs text-muted">
          Everything you changed — modes, settings, your playlists — in one file. Use it to move to
          another browser or device, or to undo an experiment.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SMALL_BUTTON} onClick={downloadBackup}>
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
              void restoreBackup(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
      </section>
    </Modal>
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
