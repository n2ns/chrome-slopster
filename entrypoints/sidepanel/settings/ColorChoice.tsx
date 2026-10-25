import { Check, Pipette, Type } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { t } from '@/src/i18n';
import { TRANSLATION_COLOR_PRESETS } from '@/src/storage/types';

interface Props {
  /** Id of the group label, also the prefix of the group's ids. */
  labelId: string;
  label: string;
  /** The color shown as selected: the stored value, or a custom color being picked. '' selects the default option. */
  color: string;
  /** When set, a first swatch with this label stands for '' (keep the page's own color). */
  defaultLabel?: string;
  /** Save a color. Resolves when the save is done, successful or not. */
  onSave: (color: string) => Promise<void>;
  /** A custom color being picked but not saved yet, or undefined when the picker is left without saving. */
  onDraft: (color: string | undefined) => void;
}

/**
 * Starting value of the custom picker while the default option is selected; the native input needs a valid color.
 * Picking the input's current value fires no change event, so it must be a color a preset swatch already offers.
 */
const PICKER_FALLBACK = TRANSLATION_COLOR_PRESETS[0].color;

/** A row of preset color swatches plus a custom color picker, optionally led by a "page default" swatch. */
export function ColorChoice({ labelId, label, color, defaultLabel, onSave, onDraft }: Props) {
  const customInput = useRef<HTMLInputElement>(null);
  const isDefault = color === '';
  const isCustom = !isDefault && !TRANSLATION_COLOR_PRESETS.some((preset) => preset.color === color);
  // The latest callbacks for the native listeners below, which are attached once.
  const callbacks = useRef({ onSave, onDraft });
  useEffect(() => {
    callbacks.current = { onSave, onDraft };
  });

  // React's onChange fires on every input event; write to sync storage only on the native change event.
  useEffect(() => {
    const input = customInput.current;
    if (!input) return;
    let saving = false;
    const commit = () => {
      saving = true;
      void callbacks.current.onSave(input.value).finally(() => {
        saving = false;
        callbacks.current.onDraft(undefined);
      });
    };
    // A picker closed without a change (e.g. cancelled) leaves no change event; drop the draft when leaving it,
    // unless a save is running, whose end drops it once the stored color is the new one.
    const discard = () => {
      if (!saving) callbacks.current.onDraft(undefined);
    };
    input.addEventListener('change', commit);
    input.addEventListener('blur', discard);
    return () => {
      input.removeEventListener('change', commit);
      input.removeEventListener('blur', discard);
    };
  }, []);

  return (
    <>
      <label id={labelId}>{label}</label>
      <div className="color-swatches" role="group" aria-labelledby={labelId}>
        {defaultLabel !== undefined && (
          <button
            type="button"
            className={isDefault ? 'swatch default selected' : 'swatch default'}
            aria-label={defaultLabel}
            title={defaultLabel}
            aria-pressed={isDefault}
            onClick={() => void onSave('')}
          >
            {isDefault ? <Check size={16} strokeWidth={3} aria-hidden /> : <Type size={15} aria-hidden />}
          </button>
        )}
        {TRANSLATION_COLOR_PRESETS.map((preset) => {
          const selected = preset.color === color;
          return (
            <button
              key={preset.color}
              type="button"
              className={selected ? 'swatch selected' : 'swatch'}
              style={{ '--swatch-color': preset.color } as CSSProperties}
              aria-label={t(preset.label)}
              title={t(preset.label)}
              aria-pressed={selected}
              onClick={() => void onSave(preset.color)}
            >
              {selected && <Check size={16} strokeWidth={3} aria-hidden />}
            </button>
          );
        })}
        <span
          className={isCustom ? 'swatch custom selected' : 'swatch custom'}
          style={isCustom ? ({ '--swatch-color': color } as CSSProperties) : undefined}
          title={t('translationColorCustom')}
        >
          <input
            ref={customInput}
            type="color"
            aria-label={isCustom ? `${t('translationColorCustom')}, ${t('colorSelected')}` : t('translationColorCustom')}
            value={isDefault ? PICKER_FALLBACK : color}
            onChange={(event) => onDraft(event.target.value)}
          />
          {isCustom ? <Check size={16} strokeWidth={3} aria-hidden /> : <Pipette size={15} aria-hidden />}
        </span>
      </div>
    </>
  );
}
