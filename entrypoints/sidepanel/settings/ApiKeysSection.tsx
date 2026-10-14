import { CircleAlert, CircleCheck, Eye, EyeOff, KeyRound, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { getApiKeys } from '@/src/storage/items';
import { saveApiKeys } from '@/src/storage/settings';
import { AI_ENGINES, type AiEngine, type ApiKeys } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { engineLabel } from '@/src/ui/labels';

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeys>();
  // Keys as last loaded or saved; only changed engines are written, so a key
  // another window saved meanwhile is not overwritten.
  const [baseline, setBaseline] = useState<ApiKeys>();
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  // Keys the operator chose to show in plain text, to check what was pasted.
  const [shown, setShown] = useState<Set<AiEngine>>(new Set());

  function toggleShown(engine: AiEngine) {
    const next = new Set(shown);
    if (next.has(engine)) next.delete(engine);
    else next.add(engine);
    setShown(next);
  }

  useEffect(() => {
    getApiKeys().then((loaded) => {
      setKeys(loaded);
      setBaseline(loaded);
    }, setError);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!keys || !baseline) return;
    setError(undefined);
    setSaved(false);
    try {
      const changed = Object.fromEntries(AI_ENGINES.filter((engine) => keys[engine] !== baseline[engine]).map((engine) => [engine, keys[engine]]));
      const stored = await saveApiKeys(changed);
      setKeys(stored);
      setBaseline(stored);
      setSaved(true);
    } catch (failure) {
      setError(failure);
    }
  }

  return (
    <section>
      <h2>
        <KeyRound className="icon" size={18} aria-hidden />
        {t('apiKeysHeading')}
      </h2>
      <p className="hint">{t('apiKeysNote')}</p>
      {keys ? (
        <form onSubmit={submit}>
          {AI_ENGINES.map((engine) => (
            <div key={engine} className="key-field">
              <label htmlFor={`key-${engine}`}>{engineLabel(engine)}</label>
              <div className="key-row">
                <input
                  id={`key-${engine}`}
                  type={shown.has(engine) ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={keys[engine]}
                  onChange={(event) => {
                    setKeys({ ...keys, [engine]: event.target.value });
                    setSaved(false);
                  }}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-controls={`key-${engine}`}
                  aria-pressed={shown.has(engine)}
                  aria-label={shown.has(engine) ? t('hideKey') : t('showKey')}
                  title={shown.has(engine) ? t('hideKey') : t('showKey')}
                  onClick={() => toggleShown(engine)}
                >
                  {shown.has(engine) ? <EyeOff className="icon" size={18} aria-hidden /> : <Eye className="icon" size={18} aria-hidden />}
                </button>
              </div>
            </div>
          ))}
          <div className="actions">
            <button type="submit" className="primary">
              <Save className="icon" size={16} aria-hidden />
              {t('save')}
            </button>
          </div>
          {saved && (
            <p className="status">
              <CircleCheck className="icon" size={16} aria-hidden />
              {t('saved')}
            </p>
          )}
        </form>
      ) : (
        !error && <p className="hint">{t('loading')}</p>
      )}
      {error !== undefined && (
        <p className="error">
          <CircleAlert className="icon" size={16} aria-hidden />
          {errorMessage(error)}
        </p>
      )}
    </section>
  );
}
