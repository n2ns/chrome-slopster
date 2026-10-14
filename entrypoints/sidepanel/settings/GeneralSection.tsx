import { Check, CircleAlert, Pipette, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { t, type MessageKey } from '@/src/i18n';
import { saveSettings } from '@/src/storage/settings';
import { TRANSLATION_COLOR_PRESETS, normalizeTranslationColor, type Settings } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { useSettings } from '@/src/ui/hooks';
import { LanguageSelect } from '@/src/ui/LanguageSelect';

const FONT_SIZES: Record<Settings['fontSize'], MessageKey> = {
  small: 'fontSizeSmall',
  medium: 'fontSizeMedium',
  large: 'fontSizeLarge',
};

export function GeneralSection() {
  const { value: settings, error: loadError, setValue } = useSettings();
  const [error, setError] = useState<unknown>();
  // Color picked in the custom picker but not saved yet (the picker fires input continuously while dragging).
  // It remembers the stored color it was picked over, so a color saved elsewhere meanwhile replaces it.
  const [draft, setDraft] = useState<{ color: string; over: string }>();
  const customInput = useRef<HTMLInputElement>(null);
  const loaded = settings !== undefined;

  // Settings save as soon as a control changes.
  const save = useCallback(
    async (patch: Partial<Settings>) => {
      setError(undefined);
      try {
        setValue(await saveSettings(patch));
      } catch (failure) {
        setError(failure);
      }
    },
    [setValue],
  );

  // React's onChange fires on every input event; write to sync storage only on the native change event.
  useEffect(() => {
    const input = customInput.current;
    if (!input) return;
    let saving = false;
    const commit = () => {
      saving = true;
      void save({ translationColor: input.value }).finally(() => {
        saving = false;
        setDraft(undefined);
      });
    };
    // A picker closed without a change (e.g. cancelled) leaves no change event; drop the draft when leaving it,
    // unless a save is running, whose end drops it once the stored color is the new one.
    const discard = () => {
      if (!saving) setDraft(undefined);
    };
    input.addEventListener('change', commit);
    input.addEventListener('blur', discard);
    return () => {
      input.removeEventListener('change', commit);
      input.removeEventListener('blur', discard);
    };
  }, [loaded, save]);

  // Same normalization as the pages, so an invalid stored value shows as the default here too.
  const storedColor = normalizeTranslationColor(settings?.translationColor);
  const shownError = error ?? loadError;
  const color = (draft && draft.over === storedColor ? draft.color : storedColor).toLowerCase();
  const isCustom = !TRANSLATION_COLOR_PRESETS.some((preset) => preset.color === color);
  return (
    <section>
      <h2>
        <SlidersHorizontal className="icon" size={18} aria-hidden />
        {t('generalHeading')}
      </h2>
      {settings ? (
        <>
          <label htmlFor="operator-language">{t('operatorLanguage')}</label>
          <LanguageSelect
            id="operator-language"
            value={settings.operatorLanguage}
            autoLabel={t('languageBrowserDefault')}
            onChange={(operatorLanguage) => save({ operatorLanguage })}
          />
          <p className="hint">{t('operatorLanguageHint')}</p>

          <label className="check">
            <input type="checkbox" checked={settings.autoTranslate} onChange={(event) => save({ autoTranslate: event.target.checked })} />
            <span>{t('autoTranslate')}</span>
          </label>

          <label id="translation-color-label">{t('translationColor')}</label>
          <div className="color-swatches" role="group" aria-labelledby="translation-color-label">
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
                  onClick={() => save({ translationColor: preset.color })}
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
                value={color}
                onChange={(event) => setDraft({ color: event.target.value, over: storedColor })}
              />
              {isCustom ? <Check size={16} strokeWidth={3} aria-hidden /> : <Pipette size={15} aria-hidden />}
            </span>
          </div>
          <p className="color-preview" style={{ '--preview-color': color } as CSSProperties}>
            {t('translateInputPlaceholder')}
          </p>

          <label htmlFor="font-size">{t('fontSize')}</label>
          <select
            id="font-size"
            value={settings.fontSize}
            onChange={(event) => save({ fontSize: event.target.value as Settings['fontSize'] })}
          >
            {(Object.keys(FONT_SIZES) as Settings['fontSize'][]).map((size) => (
              <option key={size} value={size}>
                {t(FONT_SIZES[size])}
              </option>
            ))}
          </select>
        </>
      ) : (
        !shownError && <p className="hint">{t('loading')}</p>
      )}
      {shownError !== undefined && (
        <p className="error">
          <CircleAlert className="icon" size={16} aria-hidden />
          {errorMessage(shownError)}
        </p>
      )}
    </section>
  );
}
