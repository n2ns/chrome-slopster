import { useState } from 'react';
import { t, type MessageKey } from '@/src/i18n';
import { getModelOptions, resolveModel } from '@/src/models/registry';
import { saveSettings } from '@/src/storage/settings';
import { AI_ENGINES, isAiEngine, type Settings, type TranslationEngine } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { useSettings } from '@/src/ui/hooks';
import { engineLabel } from '@/src/ui/labels';
import { LanguageSelect } from '@/src/ui/LanguageSelect';

const TRANSLATION_ENGINES: TranslationEngine[] = ['google-free', ...AI_ENGINES];
const FONT_SIZES: Record<Settings['fontSize'], MessageKey> = {
  small: 'fontSizeSmall',
  medium: 'fontSizeMedium',
  large: 'fontSizeLarge',
};

export function EnginesSection() {
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
      <h2>{t('enginesHeading')}</h2>
      {settings ? (
        <>
          <label htmlFor="translation-engine">{t('translationEngine')}</label>
          <select
            id="translation-engine"
            value={settings.translationEngine}
            onChange={(event) => save({ translationEngine: event.target.value as TranslationEngine })}
          >
            {TRANSLATION_ENGINES.map((engine) => (
              <option key={engine} value={engine}>
                {engineLabel(engine)}
              </option>
            ))}
          </select>

          <label htmlFor="ai-engine">{t('aiEngine')}</label>
          <select
            id="ai-engine"
            value={settings.aiEngine}
            onChange={(event) => isAiEngine(event.target.value) && save({ aiEngine: event.target.value })}
          >
            {AI_ENGINES.map((engine) => (
              <option key={engine} value={engine}>
                {engineLabel(engine)}
              </option>
            ))}
          </select>

          {AI_ENGINES.map((engine) => (
            <div key={engine}>
              <label htmlFor={`model-${engine}`}>{t('modelFor', engineLabel(engine))}</label>
              <select
                id={`model-${engine}`}
                value={resolveModel(engine, settings.models[engine])}
                onChange={(event) => save({ models: { ...settings.models, [engine]: event.target.value } })}
              >
                {getModelOptions(engine).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

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
          <label className="check">
            <input type="checkbox" checked={settings.aiFallback} onChange={(event) => save({ aiFallback: event.target.checked })} />
            {t('aiFallback')}
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
