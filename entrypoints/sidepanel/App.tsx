import { useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { sendToBackground } from '@/src/messaging/protocol';
import { errorMessage } from '@/src/ui/errors';
import { ReplySection } from './ReplySection';

export default function App() {
  return (
    <main className="sidepanel">
      <h1>{t('sidepanelTitle')}</h1>
      <ReplySection />
      <TranslateSection />
    </main>
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
