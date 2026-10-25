import { CircleAlert, SlidersHorizontal } from 'lucide-react';
import { useCallback, useState, type CSSProperties } from 'react';
import { t, type MessageKey } from '@/src/i18n';
import { saveSettings } from '@/src/storage/settings';
import { normalizeTranslationColor, normalizeTranslationTextColor, type Settings } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { useSettings } from '@/src/ui/hooks';
import { LanguageSelect } from '@/src/ui/LanguageSelect';
import { ColorChoice } from './ColorChoice';

const FONT_SIZES: Record<Settings['fontSize'], MessageKey> = {
  small: 'fontSizeSmall',
  medium: 'fontSizeMedium',
  large: 'fontSizeLarge',
};

export function GeneralSection() {
  const { value: settings, error: loadError, setValue } = useSettings();
  const [error, setError] = useState<unknown>();
  // Colors picked in a custom picker but not saved yet (the picker fires input continuously while dragging).
  // Each remembers the stored color it was picked over, so a color saved elsewhere meanwhile replaces it.
  const [backgroundDraft, setBackgroundDraft] = useState<{ color: string; over: string }>();
  const [textDraft, setTextDraft] = useState<{ color: string; over: string }>();

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

  // Same normalization as the pages, so an invalid stored value shows as the default here too.
  const storedBackground = normalizeTranslationColor(settings?.translationColor);
  const storedText = normalizeTranslationTextColor(settings?.translationTextColor);
  const shownError = error ?? loadError;
  const background = (backgroundDraft && backgroundDraft.over === storedBackground ? backgroundDraft.color : storedBackground).toLowerCase();
  const textColor = (textDraft && textDraft.over === storedText ? textDraft.color : storedText).toLowerCase();
  const previewStyle = { '--preview-color': background, ...(textColor ? { '--preview-text': textColor } : {}) } as CSSProperties;
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

          <ColorChoice
            labelId="translation-color-label"
            label={t('translationColor')}
            color={background}
            onSave={(translationColor) => save({ translationColor })}
            onDraft={(color) => setBackgroundDraft(color === undefined ? undefined : { color, over: storedBackground })}
          />
          <ColorChoice
            labelId="translation-text-color-label"
            label={t('translationTextColor')}
            color={textColor}
            defaultLabel={t('translationTextColorDefault')}
            onSave={(translationTextColor) => save({ translationTextColor })}
            onDraft={(color) => setTextDraft(color === undefined ? undefined : { color, over: storedText })}
          />
          <p className="color-preview" style={previewStyle}>
            {t('translationColorPreview')}
          </p>

          <label className="check">
            <input type="checkbox" checked={settings.hideOriginal} onChange={(event) => save({ hideOriginal: event.target.checked })} />
            <span>{t('hideOriginal')}</span>
          </label>

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
