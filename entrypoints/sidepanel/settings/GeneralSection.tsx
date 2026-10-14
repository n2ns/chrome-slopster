import { useState } from 'react';
import { t, type MessageKey } from '@/src/i18n';
import { saveSettings } from '@/src/storage/settings';
import type { Settings } from '@/src/storage/types';
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

  // Settings save as soon as a control changes.
  async function save(patch: Partial<Settings>) {
    setError(undefined);
    try {
      setValue(await saveSettings(patch));
    } catch (failure) {
      setError(failure);
    }
  }

  const shownError = error ?? loadError;
  return (
    <section>
      <h2>{t('generalHeading')}</h2>
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
            {t('autoTranslate')}
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
      {shownError !== undefined && <p className="error">{errorMessage(shownError)}</p>}
    </section>
  );
}
