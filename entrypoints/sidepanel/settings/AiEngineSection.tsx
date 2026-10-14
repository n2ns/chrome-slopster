import { CircleAlert, Cpu } from 'lucide-react';
import { useState } from 'react';
import { t } from '@/src/i18n';
import { getModelOptions, resolveModel } from '@/src/models/registry';
import { saveSettings } from '@/src/storage/settings';
import { AI_ENGINES, isAiEngine, type Settings, type TranslationEngine } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { useSettings } from '@/src/ui/hooks';
import { engineLabel } from '@/src/ui/labels';

const TRANSLATION_ENGINES: TranslationEngine[] = ['google-free', ...AI_ENGINES];

export function AiEngineSection() {
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
      <h2>
        <Cpu className="icon" size={18} aria-hidden />
        {t('enginesHeading')}
      </h2>
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

          {/* Only the selected engine's model is shown; it follows the AI engine select. */}
          <label htmlFor={`model-${settings.aiEngine}`}>{t('modelFor', engineLabel(settings.aiEngine))}</label>
          <select
            id={`model-${settings.aiEngine}`}
            value={resolveModel(settings.aiEngine, settings.models[settings.aiEngine])}
            onChange={(event) => save({ models: { ...settings.models, [settings.aiEngine]: event.target.value } })}
          >
            {getModelOptions(settings.aiEngine).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="check">
            <input type="checkbox" checked={settings.aiFallback} onChange={(event) => save({ aiFallback: event.target.checked })} />
            <span>{t('aiFallback')}</span>
          </label>
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
