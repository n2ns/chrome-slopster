import { useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { sendToBackground } from '@/src/messaging/protocol';
import { setActivePersona } from '@/src/storage/personas';
import { errorMessage } from '@/src/ui/errors';
import { usePersonaState } from '@/src/ui/hooks';

export default function App() {
  return (
    <main className="sidepanel">
      <h1>{t('sidepanelTitle')}</h1>
      <ReplySection />
      <TranslateSection />
    </main>
  );
}

function ReplySection() {
  const { value, error: loadError, reload } = usePersonaState();
  const [error, setError] = useState<unknown>();
  const [intent, setIntent] = useState('');

  async function selectPersona(id: string) {
    setError(undefined);
    try {
      await setActivePersona(id);
    } catch (failure) {
      setError(failure);
    }
    reload();
  }

  const shownError = error ?? loadError;
  return (
    <section>
      <label htmlFor="persona">{t('sidepanelPersona')}</label>
      <select id="persona" value={value?.activeId ?? ''} disabled={!value} onChange={(event) => selectPersona(event.target.value)}>
        {value?.personas.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.name}
          </option>
        ))}
      </select>

      <label htmlFor="intent">{t('intentLabel')}</label>
      <textarea id="intent" value={intent} placeholder={t('intentPlaceholder')} onChange={(event) => setIntent(event.target.value)} />

      <div className="actions">
        <button type="button" className="primary" disabled>
          {t('generate')}
        </button>
      </div>
      <p className="hint">{t('generateUnavailableHint')}</p>
      {shownError !== undefined && <p className="error">{errorMessage(shownError)}</p>}
    </section>
  );
}

function TranslateSection() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const translation = await sendToBackground('translate', { text });
      // The notice is appended after the translation, never sent for translation.
      setResult(translation.truncated ? `${translation.text}\n\n${t('translationTruncated')}` : translation.text);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <form onSubmit={submit}>
        <label htmlFor="translate-input">{t('translateHeading')}</label>
        <textarea
          id="translate-input"
          value={text}
          placeholder={t('translateInputPlaceholder')}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="actions">
          <button type="submit" disabled={busy || !text.trim()}>
            {busy ? t('translating') : t('translateButton')}
          </button>
        </div>
      </form>
      {result !== undefined && <p className="output">{result}</p>}
      {error !== undefined && <p className="error">{errorMessage(error)}</p>}
    </section>
  );
}
