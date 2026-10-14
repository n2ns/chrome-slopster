import { Check, CircleAlert, CircleCheck, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { getApiKeys } from '@/src/storage/items';
import { saveApiKeys } from '@/src/storage/settings';
import { AI_ENGINES, type AiEngine, type ApiKeys } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';

/** The API key of the selected AI engine. Edits to other engines' keys are kept while switching engines. */
export function ApiKeyField({ engine }: { engine: AiEngine }) {
  const [keys, setKeys] = useState<ApiKeys>();
  // Keys as last loaded or saved; only changed engines are written, so a key
  // another window saved meanwhile is not overwritten.
  const [baseline, setBaseline] = useState<ApiKeys>();
  const [error, setError] = useState<unknown>();
  // The engine whose key the save notice or save error is about, so neither shows under another engine.
  const [resultFor, setResultFor] = useState<AiEngine>();
  const [saved, setSaved] = useState(false);
  // Keys the operator chose to show in plain text, to check what was pasted.
  const [shown, setShown] = useState<Set<AiEngine>>(new Set());

  function toggleShown() {
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
    setResultFor(engine);
    try {
      const changed = Object.fromEntries(AI_ENGINES.filter((name) => keys[name] !== baseline[name]).map((name) => [name, keys[name]]));
      const stored = await saveApiKeys(changed);
      setKeys(stored);
      setBaseline(stored);
      setSaved(true);
    } catch (failure) {
      setError(failure);
    }
  }

  const id = `key-${engine}`;
  return (
    <div className="key-field">
      <label htmlFor={id}>{t('apiKeysHeading')}</label>
      {keys ? (
        <form onSubmit={submit}>
          <div className="key-row">
            <input
              id={id}
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
              aria-controls={id}
              aria-pressed={shown.has(engine)}
              aria-label={shown.has(engine) ? t('hideKey') : t('showKey')}
              title={shown.has(engine) ? t('hideKey') : t('showKey')}
              onClick={toggleShown}
            >
              {shown.has(engine) ? <EyeOff className="icon" size={18} aria-hidden /> : <Eye className="icon" size={18} aria-hidden />}
            </button>
            <button type="submit" className="primary key-save" aria-label={t('save')} title={t('save')}>
              <Check className="icon" size={18} aria-hidden />
            </button>
          </div>
          <p className="hint">{t('apiKeysNote')}</p>
          {saved && resultFor === engine && (
            <p className="status">
              <CircleCheck className="icon" size={16} aria-hidden />
              {t('saved')}
            </p>
          )}
        </form>
      ) : (
        !error && <p className="hint">{t('loading')}</p>
      )}
      {error !== undefined && (resultFor === undefined || resultFor === engine) && (
        <p className="error">
          <CircleAlert className="icon" size={16} aria-hidden />
          {errorMessage(error)}
        </p>
      )}
    </div>
  );
}
