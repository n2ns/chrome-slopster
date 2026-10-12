import { useEffect, useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { getApiKeys } from '@/src/storage/items';
import { saveApiKeys } from '@/src/storage/settings';
import { AI_ENGINES, type ApiKeys } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { engineLabel } from '@/src/ui/labels';

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeys>();
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getApiKeys().then(setKeys, setError);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!keys) return;
    setError(undefined);
    setSaved(false);
    try {
      setKeys(await saveApiKeys(keys));
      setSaved(true);
    } catch (failure) {
      setError(failure);
    }
  }

  return (
    <section>
      <h2>{t('apiKeysHeading')}</h2>
      <p className="hint">{t('apiKeysNote')}</p>
      {keys ? (
        <form onSubmit={submit}>
          {AI_ENGINES.map((engine) => (
            <div key={engine}>
              <label htmlFor={`key-${engine}`}>{engineLabel(engine)}</label>
              <input
                id={`key-${engine}`}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={keys[engine]}
                onChange={(event) => {
                  setKeys({ ...keys, [engine]: event.target.value });
                  setSaved(false);
                }}
              />
            </div>
          ))}
          <div className="actions">
            <button type="submit" className="primary">
              {t('save')}
            </button>
          </div>
          {saved && <p className="status">{t('saved')}</p>}
        </form>
      ) : (
        !error && <p className="hint">{t('loading')}</p>
      )}
      {error !== undefined && <p className="error">{errorMessage(error)}</p>}
    </section>
  );
}
