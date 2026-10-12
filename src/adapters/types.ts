// Platform adapter contract. Each supported site implements PlatformAdapter;
// everything else in the content script is platform-agnostic.

import type { PlatformId } from '@/src/storage/types';

/** The post or comment being replied to, plus surrounding context. */
export interface ThreadContext {
  /** What the reply answers: the post itself or one comment under it. */
  kind: 'post' | 'comment';
  platform: PlatformId;
  /** Permalink of the post or comment; identifies the reply target on the page. */
  url: string;
  /** r/xxx or Facebook group name; empty for X. */
  community?: string;
  author?: string;
  /** Reddit only. */
  title?: string;
  body: string;
  /** Ancestor content when replying to a comment, nearest first. */
  parentChain: string[];
  /** Sample of existing replies, at most 5. */
  comments: string[];
}

export type InsertResult = { ok: true } | { ok: false; reason: 'not-found' | 'rejected' };

export interface PlatformAdapter {
  id: PlatformId;
  matches: string[];
  /** Translatable content units on the page (posts, comments). */
  findTranslatableUnits(root: ParentNode): HTMLElement[];
  /** Plain text of one content unit. */
  extractText(unit: HTMLElement): string;
  /** Content units that get a reply button. */
  findReplyTargets(root: ParentNode): HTMLElement[];
  /** The reply target and its context. */
  extractThread(target: HTMLElement): ThreadContext;
  /** Current composer: the focused one first, then a visible one. */
  findComposer(target?: HTMLElement): HTMLElement | null;
  /** Write text into the composer. Must never send. Async because rich editors apply input asynchronously. */
  insertText(composer: HTMLElement, text: string): Promise<InsertResult>;
  /**
   * Identity of the conversation the page shows (e.g. post or status ID), or
   * null when it shows none. A selected reply target is dropped when this
   * changes. Overlay routes over a conversation (X's reply dialog) keep its key.
   */
  pageKey(doc: Document): string | null;
  /** Ad nodes; only called when the platform's ad-block toggle is on. */
  findAds(root: ParentNode): HTMLElement[];
  constraints: { maxReplyLength?: number };
}
