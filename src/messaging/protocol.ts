// Every cross-context message, as one typed map. Senders and handlers both go
// through the helpers below so payload and response types cannot drift.

import type { InsertResult, ThreadContext } from '@/src/adapters/types';
import type { GenerationRequest, GenerationResult } from '@/src/prompt/types';
import { AppError, type ErrorCode } from '@/src/providers/types';

/** Messages handled by the background service worker. */
export interface BackgroundMessages {
  /** Translate text. targetLanguage defaults to the resolved operator language. */
  /** `truncated` = the source exceeded the engine's length cap; the UI appends a localized notice. */
  translate: { request: { text: string; targetLanguage?: string }; response: { text: string; truncated: boolean } };
  generate: { request: GenerationRequest; response: GenerationResult };
  /** A reply button on the page was clicked: remember the target for this tab and open the side panel. */
  selectReplyTarget: { request: { thread: ThreadContext }; response: { sidePanelOpened: boolean } };
  /**
   * Sent by a content script when the selected target left the page, or when it
   * starts on a new document: forget the reply target of the sender's tab.
   * URL changes alone do not clear it (X opens its reply dialog at /compose/post).
   */
  clearReplyTarget: { request: Record<string, never>; response: Record<string, never> };
}

/** Messages handled by a content script, sent to a specific tab. */
export interface ContentMessages {
  /** The main post on the current page, or null when the page is not a post. */
  getThreadContext: { request: Record<string, never>; response: { thread: ThreadContext | null } };
  /** Fill the composer that belongs to `thread` (the target the draft was generated for); not-found when it is not on the page. */
  insertText: { request: { text: string; thread: ThreadContext }; response: InsertResult };
}

type MessageMap = BackgroundMessages | ContentMessages;

interface Envelope<K extends string, P> {
  type: K;
  payload: P;
}

type Reply<R> = { ok: true; data: R } | { ok: false; error: { code: ErrorCode; message: string; status?: number } };

function toReply<R>(promise: Promise<R>): Promise<Reply<R>> {
  return promise.then(
    (data) => ({ ok: true as const, data }),
    (error: unknown) => {
      if (error instanceof AppError) {
        return { ok: false as const, error: { code: error.code, message: error.message, status: error.status } };
      }
      return { ok: false as const, error: { code: 'internal-error' as const, message: String(error) } };
    },
  );
}

function unwrap<R>(reply: Reply<R> | undefined): R {
  if (!reply) throw new AppError('internal-error', 'No response from message handler.');
  if (!reply.ok) throw new AppError(reply.error.code, reply.error.message, reply.error.status);
  return reply.data;
}

export async function sendToBackground<K extends keyof BackgroundMessages>(
  type: K,
  payload: BackgroundMessages[K]['request'],
): Promise<BackgroundMessages[K]['response']> {
  const envelope: Envelope<K, typeof payload> = { type, payload };
  return unwrap(await browser.runtime.sendMessage(envelope));
}

export async function sendToTab<K extends keyof ContentMessages>(
  tabId: number,
  type: K,
  payload: ContentMessages[K]['request'],
): Promise<ContentMessages[K]['response']> {
  const envelope: Envelope<K, typeof payload> = { type, payload };
  return unwrap(await browser.tabs.sendMessage(tabId, envelope));
}

type Handlers<M extends MessageMap> = {
  [K in keyof M]?: M[K] extends { request: infer Q; response: infer R }
    ? (payload: Q, sender: Browser.runtime.MessageSender) => Promise<R>
    : never;
};

/**
 * Register handlers for one context. Messages without a handler here are left
 * for other listeners (returns false so the channel is not held open).
 */
export function registerHandlers<M extends MessageMap>(handlers: Handlers<M>): void {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    const envelope = message as Partial<Envelope<string, unknown>> | null;
    const handler = envelope?.type ? (handlers as Record<string, unknown>)[envelope.type] : undefined;
    if (typeof handler !== 'function') return false;
    void toReply((handler as (p: unknown, s: typeof sender) => Promise<unknown>)(envelope!.payload, sender)).then(sendResponse);
    return true;
  });
}
