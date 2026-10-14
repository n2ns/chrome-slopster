import { ArrowLeft, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { sendToBackground } from '@/src/messaging/protocol';
import { ErrorNotice } from '@/src/ui/ErrorNotice';
import { useSettings } from '@/src/ui/hooks';
import { SettingsNavContext, type SettingsView } from '@/src/ui/settings-nav';
import { ReplySection } from './ReplySection';
import { AiSettingsView } from './settings/AiSettingsView';
import { GeneralSettingsView } from './settings/GeneralSettingsView';

type View = 'main' | SettingsView;

export default function App() {
  const [view, setView] = useState<View>('main');
  // Once opened, each settings view stays mounted, so unsaved edits survive going back.
  const [opened, setOpened] = useState<ReadonlySet<SettingsView>>(new Set());
  const { value: settings } = useSettings();
  const fontSize = settings?.fontSize;

  // The font size setting scales the whole panel (sizes are in rem).
  useEffect(() => {
    if (fontSize) document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  function switchView(next: View) {
    setView(next);
    if (next !== 'main' && !opened.has(next)) setOpened(new Set(opened).add(next));
    window.scrollTo(0, 0);
  }

  return (
    <SettingsNavContext value={switchView}>
      <main className="sidepanel">
        <header className="sidepanel-header">
          {view === 'main' ? (
            <>
              <h1>{t('sidepanelTitle')}</h1>
              <div className="header-actions">
                <button type="button" className="icon-button" aria-label={t('aiSettingsButton')} title={t('aiSettingsButton')} onClick={() => switchView('ai')}>
                  <Sparkles className="icon" size={18} aria-hidden />
                </button>
                <button type="button" className="icon-button" aria-label={t('settingsButton')} title={t('settingsButton')} onClick={() => switchView('general')}>
                  <SettingsIcon className="icon" size={18} aria-hidden />
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="link back" onClick={() => switchView('main')}>
                <ArrowLeft className="icon" size={16} aria-hidden />
                {t('backButton')}
              </button>
              <h1>{view === 'ai' ? t('aiSettingsTitle') : t('optionsTitle')}</h1>
            </>
          )}
        </header>
        {/* The main view stays mounted while a settings view is open, so drafts in progress survive. */}
        <div hidden={view !== 'main'}>
          <ReplySection />
          <TranslateSection />
        </div>
        {opened.has('ai') && (
          <div hidden={view !== 'ai'}>
            <AiSettingsView />
          </div>
        )}
        {opened.has('general') && (
          <div hidden={view !== 'general'}>
            <GeneralSettingsView />
          </div>
        )}
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
