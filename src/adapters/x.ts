// X (twitter.com / x.com). Selectors rely on X's data-testid attributes, never
// on generated class names. Fixtures: tests/fixtures/x.

import { insertIntoRichEditor, isVisible } from './dom';
import type { PlatformAdapter, PostComposer, ThreadContext } from './types';

const TWEET = 'article[data-testid="tweet"]';
const TEXT = '[data-testid="tweetText"]';
const EDITOR = '[data-testid^="tweetTextarea_"][contenteditable="true"]';
const AD_LABELS = new Set(['Ad', 'Promoted', '广告', '推广']);
const MAX_LENGTH = 280;
const MAX_COMMENTS = 5;

/** Routes X opens as overlays on top of the current page (the reply dialog is /compose/post). */
const OVERLAY_PATH = /^\/(compose|i)\//;
const STATUS_PATH = /^\/[^/]+\/status\/(\d+)/;

/** Status ID of the conversation shown, remembered while an overlay route is open. */
let lastStatusId: string | null = null;

function statusId(doc: Document): string | null {
  const path = doc.location?.pathname ?? '';
  if (OVERLAY_PATH.test(path)) return lastStatusId;
  lastStatusId = STATUS_PATH.exec(path)?.[1] ?? null;
  return lastStatusId;
}

/**
 * Tweet text keeps its own line breaks (rendered with pre-wrap), and emoji are
 * images whose alt text is the character, so walk the nodes instead of reading
 * textContent.
 */
function tweetText(element: Element | null): string {
  if (!element) return '';
  let text = '';
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
    else if ((node as Element).tagName === 'IMG') text += (node as HTMLImageElement).alt;
  }
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function handleOf(tweet: Element): string | undefined {
  return tweet.querySelector('[data-testid="User-Name"]')?.textContent?.match(/@(\w{1,15})/)?.[1];
}

/** Handle plus post time identify a tweet; text alone is often empty (media) or repeated. */
function tweetIdentity(tweet: Element): string | null {
  const handle = handleOf(tweet);
  const time = tweet.querySelector('time')?.getAttribute('datetime');
  return handle && time ? `${handle}@${time}` : null;
}

function statusPath(tweet: Element): string | null {
  return tweet.querySelector('a[href*="/status/"] time')?.closest('a')?.getAttribute('href') ?? null;
}

function absoluteUrl(doc: Document, path: string | null): string {
  if (!path) return doc.location?.href ?? '';
  try {
    return new URL(path, doc.location?.origin || 'https://x.com').href;
  } catch {
    return doc.location?.href ?? '';
  }
}

/** Tweets of the conversation in the primary column, excluding ones inside dialogs. */
function conversation(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(TWEET)].filter((tweet) => !tweet.closest('[role="dialog"]'));
}

/** On a status page, the focal tweet is the one X renders with tabindex="-1". */
function focalTweet(doc: Document): HTMLElement | undefined {
  return conversation(doc).find((tweet) => tweet.getAttribute('tabindex') === '-1');
}

function threadOf(tweet: HTMLElement): ThreadContext {
  const doc = tweet.ownerDocument;
  const tweets = conversation(doc);
  const focal = focalTweet(doc);
  const focalIndex = focal ? tweets.indexOf(focal) : -1;
  const text = (item: Element) => tweetText(item.querySelector(TEXT));
  // Tweets above the focal one are the thread it answers, oldest first on the page.
  const ancestorsOfFocal = focalIndex > 0 ? tweets.slice(0, focalIndex).map(text).filter(Boolean).reverse() : [];
  const isFocal = tweet === focal;
  return {
    kind: isFocal ? 'post' : 'comment',
    platform: 'x',
    url: absoluteUrl(doc, statusPath(tweet)),
    author: handleOf(tweet) ? `@${handleOf(tweet)}` : undefined,
    body: text(tweet),
    parentChain: isFocal ? ancestorsOfFocal : [focal ? text(focal) : '', ...ancestorsOfFocal].filter(Boolean),
    comments: isFocal ? tweets.slice(focalIndex + 1).map(text).filter(Boolean).slice(0, MAX_COMMENTS) : [],
  };
}

/** The reply dialog X opens from a tweet's reply button, if it answers `target`. */
function dialogComposerFor(target: HTMLElement): HTMLElement | null {
  const doc = target.ownerDocument;
  for (const dialog of doc.querySelectorAll('[role="dialog"]')) {
    const quoted = dialog.querySelector(TWEET);
    const editor = dialog.querySelector<HTMLElement>(EDITOR);
    if (!quoted || !editor || !isVisible(editor)) continue;
    const identity = tweetIdentity(target);
    if (identity && tweetIdentity(quoted) === identity) return editor;
  }
  return null;
}

/**
 * The composer for a new post: X's compose dialog when it quotes no tweet, or
 * the inline "What's happening" box on a timeline. On a status page the inline
 * box replies to the focal tweet, so it is not a new-post form.
 */
function postComposer(doc: Document): PostComposer | null {
  for (const dialog of doc.querySelectorAll('[role="dialog"]')) {
    const editor = dialog.querySelector<HTMLElement>(EDITOR);
    if (!editor || !isVisible(editor)) continue;
    // A reply dialog (it quotes the tweet) covers the page: no new-post form is in reach.
    if (dialog.querySelector(TWEET)) return null;
    return { body: editor };
  }
  if (statusId(doc)) return null;
  const inline = [...doc.querySelectorAll<HTMLElement>(EDITOR)].find((editor) => !editor.closest('[role="dialog"]') && isVisible(editor));
  return inline ? { body: inline } : null;
}

export const xAdapter: PlatformAdapter = {
  id: 'x',
  matches: ['https://x.com/*', 'https://twitter.com/*'],

  findTranslatableUnits(root) {
    return [...root.querySelectorAll<HTMLElement>(`${TWEET} ${TEXT}`)].filter((unit) => !unit.closest('[role="dialog"]'));
  },

  extractText(unit) {
    return tweetText(unit);
  },

  findReplyTargets(root) {
    // Replies are drafted from a tweet's own page. The focal tweet may be unmounted by
    // X's virtualized list, so the page is recognized by its key, not by the focal tweet.
    const doc = root instanceof Document ? root : (root as Node).ownerDocument;
    if (!doc || !statusId(doc)) return [];
    const focal = focalTweet(doc);
    // The focal tweet first, so getThreadContext answers with it.
    return conversation(doc).sort((a, b) => Number(b === focal) - Number(a === focal));
  },

  extractThread(target) {
    return threadOf(target);
  },

  findComposer(target) {
    const doc = target?.ownerDocument ?? document;
    if (target) {
      const inDialog = dialogComposerFor(target);
      if (inDialog) return inDialog;
      // The inline box under the focal tweet answers the focal tweet only.
      if (target !== focalTweet(doc)) return null;
      return [...doc.querySelectorAll<HTMLElement>(EDITOR)].find((editor) => !editor.closest('[role="dialog"]') && isVisible(editor)) ?? null;
    }
    const editors = [...doc.querySelectorAll<HTMLElement>(EDITOR)].filter(isVisible);
    return editors.find((editor) => editor === doc.activeElement || editor.contains(doc.activeElement)) ?? editors[0] ?? null;
  },

  insertText(composer, text) {
    return insertIntoRichEditor(composer, text);
  },

  pageKey(doc) {
    return statusId(doc);
  },

  postTarget(doc) {
    if (!postComposer(doc)) return null;
    return { kind: 'post', platform: 'x', url: `${doc.location?.origin ?? ''}${doc.location?.pathname ?? ''}`, body: '', parentChain: [], comments: [] };
  },

  findPostComposer(doc) {
    return postComposer(doc);
  },

  insertPost(composer, draft) {
    return insertIntoRichEditor(composer.body, draft.body);
  },

  findAds(root) {
    // Promoted tweets carry a standalone "Ad" label outside the author name and tweet text; hide the whole timeline cell.
    const isLabel = (span: Element) =>
      AD_LABELS.has(span.textContent?.trim() ?? '') && !span.closest(`${TEXT}, [data-testid="User-Name"]`);
    return [...root.querySelectorAll<HTMLElement>(TWEET)]
      .filter((tweet) => [...tweet.querySelectorAll('span')].some(isLabel))
      .map((tweet) => tweet.closest<HTMLElement>('[data-testid="cellInnerDiv"]') ?? tweet);
  },

  constraints: { maxReplyLength: MAX_LENGTH },
};
