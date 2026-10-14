import { useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { sendToBackground } from '@/src/messaging/protocol';
import { ErrorNotice } from '@/src/ui/ErrorNotice';
import { SettingsNavContext } from '@/src/ui/settings-nav';
import { ReplySection } from './ReplySection';
import { SettingsView } from './settings/SettingsView';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  function switchView(settings: boolean) {
    setShowSettings(settings);
    window.scrollTo(0, 0);
  }

  return (
    <SettingsNavContext value={() => switchView(true)}>
      <main className="sidepanel">
        <header className="sidepanel-header">
          {showSettings ? (
            <>
              <button type="button" className="link" onClick={() => switchView(false)}>
                ← {t('backButton')}
              </button>
              <h1>{t('optionsTitle')}</h1>
            </>
          ) : (
            <>
              <h1>{t('sidepanelTitle')}</h1>
              <button type="button" className="link" onClick={() => switchView(true)}>
                {t('settingsButton')}
              </button>
            </>
          )}
        </header>
        {/* The main view stays mounted while the settings are open, so drafts in progress survive. */}
        <div hidden={showSettings}>
          <ReplySection />
          <TranslateSection />
        </div>
        {showSettings && <SettingsView />}
      </main>
    </SettingsNavContext>
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
      {error !== undefined && <ErrorNotice error={error} />}
    </section>
  );
}
