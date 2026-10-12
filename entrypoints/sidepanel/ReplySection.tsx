import { useState } from 'react';
import type { ThreadContext } from '@/src/adapters/types';
import { t, type MessageKey } from '@/src/i18n';
import { sendToBackground, sendToTab } from '@/src/messaging/protocol';
import type { GenerationMode, GenerationResult } from '@/src/prompt/types';
import { replyTargetItem } from '@/src/storage/items';
import { setActivePersona } from '@/src/storage/personas';
import type { PlatformId } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { usePersonaState, useSettings } from '@/src/ui/hooks';
import { useActiveTab, useReplyTarget } from '@/src/ui/tabs';
import { DraftResult, PLATFORM_KEYS, type FlowProps, type Notice } from './draft';
import { PostFlow } from './PostFlow';

/** Hosts each platform's pages live on. */
const PLATFORM_HOSTS: Record<PlatformId, string[]> = {
  reddit: ['reddit.com'],
  x: ['x.com', 'twitter.com'],
  facebook: ['facebook.com'],
};

/** Whether the tab shows a page of `platform`. URLs are only visible for sites the extension may access. */
function isOnPlatform(url: string | undefined, platform: PlatformId): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return PLATFORM_HOSTS[platform].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

const FILL_FAILURE_KEYS: Record<'not-found' | 'rejected', MessageKey> = {
  'not-found': 'replyFillNotFound',
  rejected: 'replyFillRejected',
};

export function ReplySection() {
  const { value, error: loadError, reload } = usePersonaState();
  const { value: settings } = useSettings();
  const { tabId, url } = useActiveTab();
  const [error, setError] = useState<unknown>();
  const [intent, setIntent] = useState('');
  const [mode, setMode] = useState<GenerationMode>('reply');

  async function selectPersona(id: string) {
    setError(undefined);
    try {
      await setActivePersona(id);
    } catch (failure) {
      setError(failure);
    }
    reload();
  }

  const persona = value?.personas.find((candidate) => candidate.id === value.activeId);
  const shownError = error ?? loadError;
  return (
    <section>
      <div className="mode-switch" role="group" aria-label={t('draftModeLabel')}>
        {(['reply', 'post'] as const).map((option) => (
          <button key={option} type="button" aria-pressed={mode === option} onClick={() => setMode(option)}>
            {t(option === 'reply' ? 'modeReply' : 'modePost')}
          </button>
        ))}
      </div>

      <label htmlFor="persona">{t('sidepanelPersona')}</label>
      <select id="persona" value={value?.activeId ?? ''} disabled={!value} onChange={(event) => selectPersona(event.target.value)}>
        {value?.personas.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>

      <label htmlFor="intent">{t('intentLabel')}</label>
      <textarea id="intent" value={intent} placeholder={t(mode === 'reply' ? 'intentPlaceholder' : 'postIntentPlaceholder')} onChange={(event) => setIntent(event.target.value)} />
      {shownError !== undefined && <p className="error">{errorMessage(shownError)}</p>}

      {/* Remount per tab. A URL change keeps the draft (X opens its reply dialog at
          /compose/post); filling is matched to the draft's own target by the page.
          Both flows stay mounted so switching modes keeps each one's draft. */}
      <div id="reply-flow" hidden={mode !== 'reply'}>
        <ReplyFlow key={tabId} tabId={tabId} url={url} persona={persona} intent={intent} operatorLanguage={settings?.operatorLanguage} />
      </div>
      <div id="post-flow" hidden={mode !== 'post'}>
        <PostFlow key={tabId} tabId={tabId} url={url} persona={persona} intent={intent} operatorLanguage={settings?.operatorLanguage} />
      </div>
    </section>
  );
}

function ReplyFlow({ tabId, url, persona, intent, operatorLanguage }: FlowProps) {
  const savedTarget = useReplyTarget(tabId);
  // A target stays stored while the tab shows another site (no content script there to clear it); ignore it then.
  const storedTarget = savedTarget && isOnPlatform(url, savedTarget.platform) ? savedTarget : null;
  // The page's own thread, tagged with the URL it was read from so it is forgotten after navigation.
  const [pageRead, setPageRead] = useState<{ url: string | undefined; thread: ThreadContext | null }>({ url: undefined, thread: null });
  const pageThread = pageRead.url === url ? pageRead.thread : null;
  const [noThread, setNoThread] = useState(false);
  const [result, setResult] = useState<{ thread: ThreadContext; generation: GenerationResult }>();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'generate' | 'fill'>();
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState<Notice>();

  const target = storedTarget ?? pageThread;

  /** The selected target, else the page's main post, asked afresh so it is never from an earlier page. */
  async function resolveThread(): Promise<ThreadContext | null> {
    if (storedTarget) return storedTarget;
    if (tabId === undefined) return null;
    try {
      const { thread } = await sendToTab(tabId, 'getThreadContext', {});
      setPageRead({ url, thread });
      return thread;
    } catch {
      // No content script on this page.
      return null;
    }
  }

  async function generate() {
    if (!persona || operatorLanguage === undefined) return;
    setBusy('generate');
    setError(undefined);
    setNotice(undefined);
    setNoThread(false);
    try {
      const thread = await resolveThread();
      if (!thread) {
        setNoThread(true);
        return;
      }
      const generation = await sendToBackground('generate', { mode: 'reply', thread, persona, intent, operatorLanguage });
      setResult({ thread, generation });
      setDraft(generation.parsed?.reply ?? '');
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(undefined);
    }
  }

  async function clearTarget() {
    setPageRead({ url, thread: null });
    if (storedTarget && tabId !== undefined) {
      try {
        await replyTargetItem(tabId).removeValue();
      } catch (failure) {
        setError(failure);
      }
    }
  }

  async function copy() {
    setError(undefined);
    setNotice(undefined);
    try {
      await navigator.clipboard.writeText(draft);
      setNotice({ key: 'replyCopied', ok: true });
    } catch (failure) {
      setError(failure);
    }
  }

  async function fill() {
    if (tabId === undefined || !result) return;
    setBusy('fill');
    setError(undefined);
    setNotice(undefined);
    try {
      const inserted = await sendToTab(tabId, 'insertText', { text: draft, thread: result.thread });
      setNotice(inserted.ok ? { key: 'replyFilled', ok: true } : { key: FILL_FAILURE_KEYS[inserted.reason], ok: false });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <>
      {target && <TargetPreview thread={target} onClear={clearTarget} />}

      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={busy !== undefined || !persona || operatorLanguage === undefined}
          onClick={generate}
        >
          {busy === 'generate' ? t('generating') : t('generate')}
        </button>
      </div>
      {noThread && <p className="hint">{t('replyNoThread')}</p>}

      {result && (
        <DraftResult
          mode="reply"
          generation={result.generation}
          platform={result.thread.platform}
          draft={draft}
          onDraftChange={setDraft}
          canCopy={!!draft}
          canFill={!!draft.trim() && busy === undefined && tabId !== undefined}
          filling={busy === 'fill'}
          onCopy={copy}
          onFill={fill}
        />
      )}

      {notice && <p className={notice.ok ? 'status' : 'error'}>{t(notice.key)}</p>}
      {error !== undefined && <p className="error">{errorMessage(error)}</p>}
    </>
  );
}

function firstLine(text: string): string {
  return text.split('\n').find((line) => line.trim())?.trim() ?? '';
}

function TargetPreview({ thread, onClear }: { thread: ThreadContext; onClear: () => void }) {
  const isComment = thread.kind === 'comment';
  // For a comment, the comment itself says more than the post title.
  const summary = firstLine(isComment ? thread.body : thread.title || thread.body);
  const meta = [t(PLATFORM_KEYS[thread.platform]), thread.community].filter(Boolean).join(' · ');
  return (
    <div className="target">
      <div className="target-header">
        <span className="target-heading">{t('replyTargetHeading')}</span>
        <button type="button" onClick={onClear}>
          {t('replyTargetClear')}
        </button>
      </div>
      <p className="target-meta">{meta}</p>
      <p className="target-summary">{summary}</p>
      {isComment && <p className="hint">{t('replyTargetComment')}</p>}
    </div>
  );
}
