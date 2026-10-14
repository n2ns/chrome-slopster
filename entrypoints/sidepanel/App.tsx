import { Languages, LoaderCircle, Settings as SettingsIcon, Sparkles, UsersRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { sendToBackground } from '@/src/messaging/protocol';
import { ErrorNotice } from '@/src/ui/ErrorNotice';
import { useSettings } from '@/src/ui/hooks';
import { SettingsNavContext, type SettingsView } from '@/src/ui/settings-nav';
import { ReplySection } from './ReplySection';
import { AiSettingsView } from './settings/AiSettingsView';
import { GeneralSettingsView } from './settings/GeneralSettingsView';
import { PersonasSettingsView } from './settings/PersonasSettingsView';

type View = 'main' | SettingsView;

const NAV = [
  { view: 'personas', label: 'personasHeading', Icon: UsersRound },
  { view: 'ai', label: 'aiSettingsButton', Icon: Sparkles },
  { view: 'general', label: 'settingsButton', Icon: SettingsIcon },
] as const;

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
        {/* Fixed navigation on every view: the title goes home; a view's button is highlighted while open and goes home when clicked again. */}
        <header className="sidepanel-header">
          <h1>
            <button type="button" className="home" onClick={() => switchView('main')}>
              {t('sidepanelTitle')}
            </button>
          </h1>
          <nav className="header-actions">
            {NAV.map(({ view: target, label, Icon }) => (
              <button
                key={target}
                type="button"
                className="icon-button"
                aria-label={t(label)}
                title={t(label)}
                aria-pressed={view === target}
                onClick={() => switchView(view === target ? 'main' : target)}
              >
                <Icon className="icon" size={18} aria-hidden />
              </button>
            ))}
          </nav>
        </header>
        {/* The main view stays mounted while a settings view is open, so drafts in progress survive. */}
        <div hidden={view !== 'main'}>
          <ReplySection />
          <TranslateSection />
        </div>
        {opened.has('personas') && (
          <div hidden={view !== 'personas'}>
            <PersonasSettingsView />
          </div>
        )}
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
    <section className="translate">
      <form onSubmit={submit}>
        <label htmlFor="translate-input" className="section-heading">
          <Languages className="icon" size={18} aria-hidden />
          {t('translateHeading')}
        </label>
        <textarea
          id="translate-input"
          value={text}
          placeholder={t('translateInputPlaceholder')}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="actions">
          <button type="submit" disabled={busy || !text.trim()}>
            {busy ? <LoaderCircle className="icon spin" size={16} aria-hidden /> : <Languages className="icon" size={16} aria-hidden />}
            {busy ? t('translating') : t('translateButton')}
          </button>
        </div>
      </form>
      {result !== undefined && <p className="output">{result}</p>}
      {error !== undefined && <ErrorNotice error={error} />}
    </section>
  );
}
