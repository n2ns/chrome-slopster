// New-post drafting for the active tab: read where the open new-post form
// would publish, generate a draft for it, and fill the form. Never publishes.

import { LoaderCircle, SquarePen, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import type { ThreadContext } from '@/src/adapters/types';
import { t, type MessageKey } from '@/src/i18n';
import { sendToBackground, sendToTab } from '@/src/messaging/protocol';
import type { GenerationResult } from '@/src/prompt/types';
import { ErrorNotice } from '@/src/ui/ErrorNotice';
import { DraftResult, PLATFORM_KEYS, type FlowProps, type Notice } from './draft';

const FILL_FAILURE_KEYS: Record<'not-found' | 'rejected', MessageKey> = {
  'not-found': 'postFillNotFound',
  rejected: 'replyFillRejected',
};

export function PostFlow({ tabId, url, persona, intent, operatorLanguage }: FlowProps) {
  // The page's post target, tagged with the URL it was read from so it is forgotten after navigation.
  const [pageRead, setPageRead] = useState<{ url: string | undefined; target: ThreadContext | null }>({ url: undefined, target: null });
  const shownTarget = pageRead.url === url ? pageRead.target : null;
  const [noTarget, setNoTarget] = useState(false);
  const [result, setResult] = useState<{ target: ThreadContext; generation: GenerationResult }>();
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'generate' | 'fill'>();
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState<Notice>();

  /** Where the open new-post form would publish, asked afresh so it is never from an earlier page. */
  async function readTarget(): Promise<ThreadContext | null> {
    if (tabId === undefined) return null;
    try {
      const { target } = await sendToTab(tabId, 'getPostTarget', {});
      setPageRead({ url, target });
      return target;
    } catch {
      // No content script on this page.
      setPageRead({ url, target: null });
      return null;
    }
  }

  async function generate() {
    if (!persona || operatorLanguage === undefined) return;
    setBusy('generate');
    setError(undefined);
    setNotice(undefined);
    setNoTarget(false);
    try {
      const target = await readTarget();
      if (!target) {
        setNoTarget(true);
        return;
      }
      const generation = await sendToBackground('generate', { mode: 'post', thread: target, persona, intent, operatorLanguage });
      setResult({ target, generation });
      setTitle(generation.parsed?.title ?? '');
      setDraft(generation.parsed?.reply ?? '');
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(undefined);
    }
  }

  const needsTitle = result?.target.platform === 'reddit';

  async function copy() {
    setError(undefined);
    setNotice(undefined);
    try {
      await navigator.clipboard.writeText(needsTitle && title ? `${title}\n\n${draft}` : draft);
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
      const inserted = await sendToTab(tabId, 'insertPost', {
        ...(needsTitle ? { title } : {}),
        body: draft,
        target: result.target,
      });
      setNotice(inserted.ok ? { key: 'postFilled', ok: true } : { key: FILL_FAILURE_KEYS[inserted.reason], ok: false });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <>
      {shownTarget && <PostTargetPreview target={shownTarget} />}

      <div className="actions">
        <button
          type="button"
          className="primary generate"
          disabled={busy !== undefined || !persona || operatorLanguage === undefined}
          onClick={generate}
        >
          {busy === 'generate' ? <LoaderCircle className="icon spin" size={16} aria-hidden /> : <WandSparkles className="icon" size={16} aria-hidden />}
          {busy === 'generate' ? t('generating') : t('generate')}
        </button>
      </div>
      {noTarget && <p className="hint">{t('postNoTarget')}</p>}

      {result && (
        <DraftResult
          mode="post"
          generation={result.generation}
          platform={result.target.platform}
          draft={draft}
          onDraftChange={setDraft}
          canCopy={!!draft}
          canFill={!!draft.trim() && (!needsTitle || !!title.trim()) && busy === undefined && tabId !== undefined}
          filling={busy === 'fill'}
          onCopy={copy}
          onFill={fill}
        >
          {needsTitle && (
            <>
              <label htmlFor="post-title">{t('postTitleLabel')}</label>
              <input id="post-title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
              {!title.trim() && <p className="error">{t('postTitleRequired')}</p>}
            </>
          )}
        </DraftResult>
      )}

      {notice && <p className={notice.ok ? 'status' : 'error'}>{t(notice.key)}</p>}
      {error !== undefined && <ErrorNotice error={error} />}
    </>
  );
}

function PostTargetPreview({ target }: { target: ThreadContext }) {
  const meta = [t(PLATFORM_KEYS[target.platform]), target.community].filter(Boolean).join(' · ');
  return (
    <div className="target">
      <div className="target-header">
        <span className="target-heading">
          <SquarePen className="icon" size={14} aria-hidden />
          {t('postTargetHeading')}
        </span>
      </div>
      <p className="target-meta">{meta}</p>
    </div>
  );
}
