import { Check, CircleAlert, CircleCheck, Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { getApiKeys } from '@/src/storage/items';
import { saveApiKeys } from '@/src/storage/settings';
import { AI_ENGINES, type AiEngine, type ApiKeys } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { engineLabel } from '@/src/ui/labels';

/** The API key of the selected AI engine. Edits to other engines' keys are kept while switching engines. */
export function ApiKeyField({ engine }: { engine: AiEngine }) {
  const [keys, setKeysState] = useState<ApiKeys>();
  // Latest keys for saves that run after a queued one finishes.
  const keysRef = useRef<ApiKeys | undefined>(undefined);
  // Keys as last loaded or saved; only changed engines are written, so a key
  // another window saved meanwhile is not overwritten.
  const baselineRef = useRef<ApiKeys | undefined>(undefined);
  // Saves run one after another, each against the baseline the previous one left.
  const queueRef = useRef(Promise.resolve());
  const [error, setError] = useState<unknown>();
  // The engine whose key the last save was about: the saved notice shows only under it,
  // and a save error names it when another engine is selected.
  const [resultFor, setResultFor] = useState<AiEngine>();
  const [saved, setSaved] = useState(false);
  // Keys the operator chose to show in plain text, to check what was pasted.
  const [shown, setShown] = useState<Set<AiEngine>>(new Set());

  function setKeys(next: ApiKeys) {
    keysRef.current = next;
    setKeysState(next);
  }

  function toggleShown() {
    const next = new Set(shown);
    if (next.has(engine)) next.delete(engine);
    else next.add(engine);
    setShown(next);
  }

  useEffect(() => {
    getApiKeys().then((loaded) => {
      baselineRef.current = loaded;
      setKeys(loaded);
    }, setError);
  }, []);

  async function saveNow(savedEngine: AiEngine, explicit: boolean) {
    const sent = keysRef.current;
    const baseline = baselineRef.current;
    if (!sent || !baseline) return;
    const changed = Object.fromEntries(AI_ENGINES.filter((name) => sent[name] !== baseline[name]).map((name) => [name, sent[name]]));
    if (Object.keys(changed).length === 0) {
      // Nothing to write; an explicit save still confirms.
      if (explicit) {
        setResultFor(savedEngine);
        setSaved(true);
      }
      return;
    }
    setError(undefined);
    setSaved(false);
    setResultFor(savedEngine);
    try {
      const stored = await saveApiKeys(changed);
      baselineRef.current = stored;
      // Keep anything typed while the save ran; take the stored (trimmed) value elsewhere.
      const current = keysRef.current ?? stored;
      setKeys(Object.fromEntries(AI_ENGINES.map((name) => [name, current[name] === sent[name] ? stored[name] : current[name]])) as ApiKeys);
      setSaved(true);
    } catch (failure) {
      setError(failure);
    }
  }

  function save(explicit: boolean) {
    const savedEngine = engine;
    queueRef.current = queueRef.current.then(() => saveNow(savedEngine, explicit));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save(true);
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
                setKeys({ ...keysRef.current!, [engine]: event.target.value });
                setSaved(false);
              }}
              // Leaving the field saves a changed key.
              onBlur={() => save(false)}
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
      {error !== undefined && (
        <p className="error">
          <CircleAlert className="icon" size={16} aria-hidden />
          {resultFor && resultFor !== engine ? `${engineLabel(resultFor)}: ${errorMessage(error)}` : errorMessage(error)}
        </p>
      )}
    </div>
  );
}
