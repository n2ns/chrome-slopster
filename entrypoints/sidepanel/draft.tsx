// Presentation shared by the reply and new-post flows: the parsed result
// (verdict, editable draft, review copy) and the copy / fill actions.

import { CircleCheck, ClipboardPaste, Copy, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { t, type MessageKey } from '@/src/i18n';
import { X_MAX_CHARS } from '@/src/prompt/platforms/x';
import type { GenerationMode, GenerationResult, ParsedGeneration } from '@/src/prompt/types';
import type { Persona, PlatformId } from '@/src/storage/types';

/** Props of a per-tab drafting flow; persona and intent are shared by both modes. */
export interface FlowProps {
  tabId: number | undefined;
  url: string | undefined;
  persona: Persona | undefined;
  intent: string;
  operatorLanguage: string | undefined;
}

export interface Notice {
  key: MessageKey;
  ok: boolean;
}

export const PLATFORM_KEYS: Record<PlatformId, MessageKey> = {
  reddit: 'replyPlatformReddit',
  x: 'replyPlatformX',
  facebook: 'replyPlatformFacebook',
};

interface ModeText {
  verdictYes: MessageKey;
  verdictNo: MessageKey;
  draftLabel: MessageKey;
  overLimit: MessageKey;
  fill: MessageKey;
  reminder: MessageKey;
}

const MODE_TEXT: Record<GenerationMode, ModeText> = {
  reply: {
    verdictYes: 'replyVerdictYes',
    verdictNo: 'replyVerdictNo',
    draftLabel: 'replyDraftLabel',
    overLimit: 'replyOverLimit',
    fill: 'replyFill',
    reminder: 'replyManualSendReminder',
  },
  post: {
    verdictYes: 'postVerdictYes',
    verdictNo: 'postVerdictNo',
    draftLabel: 'postDraftLabel',
    overLimit: 'postOverLimit',
    fill: 'postFill',
    reminder: 'postManualPublishReminder',
  },
};

interface ParsedProps {
  mode: GenerationMode;
  parsed: ParsedGeneration;
  platform: PlatformId;
  draft: string;
  onDraftChange: (draft: string) => void;
  /** Fields shown between the verdict and the draft (the Reddit post title). */
  children?: ReactNode;
}

function ParsedResult({ mode, parsed, platform, draft, onDraftChange, children }: ParsedProps) {
  const text = MODE_TEXT[mode];
  // Code points, so emoji count once; X's own weighting may differ slightly.
  const length = [...draft].length;
  const overLimit = platform === 'x' && length > X_MAX_CHARS;
  return (
    <>
      <p className={parsed.shouldReply ? 'verdict' : 'verdict warning'}>
        {parsed.shouldReply ? <CircleCheck className="icon" size={18} aria-hidden /> : <TriangleAlert className="icon" size={18} aria-hidden />}
        <span>
          <strong>{t(parsed.shouldReply ? text.verdictYes : text.verdictNo)}</strong> {parsed.reason}
        </span>
      </p>

      {children}

      <label htmlFor={`${mode}-draft`}>{t(text.draftLabel)}</label>
      <textarea id={`${mode}-draft`} className="draft" value={draft} onChange={(event) => onDraftChange(event.target.value)} />
      {platform === 'x' && (
        <p id={`${mode}-count`} className={overLimit ? 'error' : 'hint'}>
          {t('replyCharCount', [String(length), String(X_MAX_CHARS)])}
        </p>
      )}
      {overLimit && <p className="error">{t(text.overLimit, String(X_MAX_CHARS))}</p>}

      {parsed.replyNative && (
        <>
          <label>{t('replyNativeLabel')}</label>
          <p className="output native">{parsed.replyNative}</p>
        </>
      )}
      {parsed.reviewNotes && (
        <>
          <label>{t('replyReviewNotesLabel')}</label>
          <p className="output notes">{parsed.reviewNotes}</p>
        </>
      )}
    </>
  );
}

interface DraftResultProps extends Omit<ParsedProps, 'parsed'> {
  generation: GenerationResult;
  canCopy: boolean;
  canFill: boolean;
  filling: boolean;
  onCopy: () => void;
  onFill: () => void;
}

/** A generation result with its copy and fill actions. There is deliberately no send / publish action. */
export function DraftResult({ generation, canCopy, canFill, filling, onCopy, onFill, ...parsedProps }: DraftResultProps) {
  const text = MODE_TEXT[parsedProps.mode];
  const parsed = generation.parsed;
  return (
    <div className="result">
      {parsed ? (
        <ParsedResult parsed={parsed} {...parsedProps} />
      ) : (
        <>
          <p className="error">{t('replyUnparsed')}</p>
          <pre className="output raw">{generation.raw}</pre>
        </>
      )}
      <div className="actions">
        <button type="button" disabled={!parsed || !canCopy} onClick={onCopy}>
          <Copy className="icon" size={16} aria-hidden />
          {t('replyCopy')}
        </button>
        <button type="button" className="primary" disabled={!parsed || !canFill} onClick={onFill}>
          {filling ? <LoaderCircle className="icon spin" size={16} aria-hidden /> : <ClipboardPaste className="icon" size={16} aria-hidden />}
          {filling ? t('replyFilling') : t(text.fill)}
        </button>
      </div>
      <p className="hint">{t(text.reminder)}</p>
    </div>
  );
}
