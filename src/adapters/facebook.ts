// Facebook (www.facebook.com). Class names are generated, so selectors rely on
// ARIA roles, dir="auto" text blocks, and the stable data-ad-rendering-role
// markers on posts. Fixtures: tests/fixtures/facebook.

import { insertIntoRichEditor, isVisible } from './dom';
import type { PlatformAdapter, ThreadContext } from './types';

const ARTICLE = '[role="article"]';
const MESSAGE = '[data-ad-rendering-role="story_message"]';
const EDITOR = '[role="textbox"][contenteditable="true"]';
const POST_LINK = 'a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid="], a[href*="/videos/"], a[href*="/reel/"], a[href*="/photo"]';
const MAX_COMMENTS = 5;

function parentArticle(element: Element): Element | null {
  return element.parentElement?.closest(ARTICLE) ?? null;
}

/** A post is a top-level article with the post action bar (comment button). */
function isPost(article: Element): boolean {
  return !parentArticle(article) && !!article.querySelector('[data-ad-rendering-role="comment_button"]');
}

function postOf(element: Element): Element | null {
  let article = element.closest(ARTICLE);
  while (article && parentArticle(article)) article = parentArticle(article);
  return article && isPost(article) ? article : null;
}

function isComment(article: Element): boolean {
  return !!parentArticle(article) && !!postOf(article);
}

function domDepth(element: Element): number {
  let depth = 0;
  for (let node: Element | null = element; node; node = node.parentElement) depth += 1;
  return depth;
}

function collapse(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Visible text without inline controls such as "See more". */
function plainText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('[role="button"]').forEach((control) => control.remove());
  return collapse(clone.textContent);
}

/** Text of a Facebook text block: one paragraph per innermost dir="auto" block. */
function fbText(element: Element | null | undefined): string {
  if (!element) return '';
  const blocks = [...element.querySelectorAll('div[dir="auto"]')].filter((block) => !block.querySelector('div[dir="auto"]'));
  if (blocks.length === 0) return plainText(element);
  return blocks.map(plainText).filter(Boolean).join('\n\n');
}

/** The comment's own text blocks (outermost dir="auto" blocks not inside a nested article). */
function commentBodies(comment: Element): HTMLElement[] {
  return [...comment.querySelectorAll<HTMLElement>('div[dir="auto"]')].filter(
    (block) => block.closest(ARTICLE) === comment && !block.parentElement?.closest('div[dir="auto"]') && !block.closest('a, [role="button"]') && collapse(block.textContent),
  );
}

function commentText(comment: Element): string {
  return commentBodies(comment).map((block) => fbText(block)).join('\n\n');
}

function postText(post: Element): string {
  const message = [...post.querySelectorAll(MESSAGE)].find((candidate) => candidate.closest(ARTICLE) === post);
  return fbText(message);
}

function absolute(doc: Document, href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, doc.location?.origin || 'https://www.facebook.com').href;
  } catch {
    return null;
  }
}

/** Query parameters that identify a post (photo, permalink.php, story.php, watch); the rest is tracking. */
const POST_ID_PARAMS = ['fbid', 'story_fbid', 'id', 'v'];

function postUrl(post: Element): string {
  const doc = post.ownerDocument;
  const link = [...post.querySelectorAll<HTMLAnchorElement>(POST_LINK)].find((anchor) => anchor.closest(ARTICLE) === post);
  const url = absolute(doc, link?.getAttribute('href'));
  if (!url) {
    // No permalink in the post: tell posts on one page apart by their feed position.
    const position = post.getAttribute('aria-posinset');
    return `${doc.location?.href ?? ''}${position ? `#post-${position}` : ''}`;
  }
  const parsed = new URL(url);
  const kept = new URLSearchParams();
  for (const name of POST_ID_PARAMS) {
    const value = parsed.searchParams.get(name);
    if (value) kept.set(name, value);
  }
  parsed.search = kept.toString();
  parsed.hash = '';
  return parsed.href;
}

function commentId(comment: Element): string | null {
  for (const anchor of comment.querySelectorAll('a[href*="comment_id="]')) {
    if (anchor.closest(ARTICLE) !== comment) continue;
    const url = absolute(comment.ownerDocument, anchor.getAttribute('href'));
    if (!url) continue;
    const params = new URL(url).searchParams;
    const id = params.get('reply_comment_id') ?? params.get('comment_id');
    if (id) return id;
  }
  return null;
}

function authorOf(article: Element): string | undefined {
  if (isPost(article)) {
    // The name row also holds co-authors and a Follow button; the first link is the author.
    const row = article.querySelector('[data-ad-rendering-role="profile_name"]');
    return collapse((row?.querySelector('a, strong') ?? row)?.textContent) || undefined;
  }
  const name = [...article.querySelectorAll('a')].find((anchor) => anchor.closest(ARTICLE) === article && collapse(anchor.textContent));
  return collapse(name?.textContent) || undefined;
}

/**
 * Comments of a post in page order. Facebook renders replies as flat siblings
 * of comments, only nested deeper in the DOM (verified 2026-10-12), so a reply
 * is a comment deeper than the shallowest ones and belongs to the top-level
 * comment before it.
 */
function commentsOf(post: Element): Element[] {
  return [...post.querySelectorAll(ARTICLE)].filter(isComment);
}

function topLevelComments(post: Element): Element[] {
  const comments = commentsOf(post);
  const shallowest = Math.min(...comments.map(domDepth));
  return comments.filter((comment) => domDepth(comment) === shallowest);
}

/** The top-level comment a comment belongs to (itself when it is top-level). */
function threadHead(comment: Element, post: Element): Element | undefined {
  const tops = topLevelComments(post);
  if (tops.includes(comment)) return comment;
  return tops.filter((top) => follows(top, comment)).pop();
}

/** The comments in a top-level comment's thread: itself and the replies after it, up to the next top-level comment. */
function threadComments(head: Element, post: Element): Element[] {
  const tops = topLevelComments(post);
  const next = tops[tops.indexOf(head) + 1];
  return commentsOf(post).filter((comment) => comment === head || (follows(head, comment) && (!next || follows(comment, next))));
}

function threadOf(target: Element): ThreadContext {
  if (isPost(target)) {
    return {
      kind: 'post',
      platform: 'facebook',
      url: postUrl(target),
      author: authorOf(target),
      body: postText(target),
      parentChain: [],
      comments: topLevelComments(target).map(commentText).filter(Boolean).slice(0, MAX_COMMENTS),
    };
  }
  const post = postOf(target)!;
  const head = threadHead(target, post);
  const isReply = !!head && head !== target;
  const ancestors = [isReply ? commentText(head) : '', postText(post)].filter(Boolean);
  const replies = !isReply && head ? threadComments(head, post).filter((comment) => comment !== head) : [];
  const id = commentId(target);
  const base = postUrl(post);
  return {
    kind: 'comment',
    platform: 'facebook',
    url: id ? `${base.split('#')[0]}${base.includes('?') ? '&' : '?'}comment_id=${encodeURIComponent(id)}` : base,
    author: authorOf(target),
    body: commentText(target),
    parentChain: ancestors,
    comments: replies.map(commentText).filter(Boolean).slice(0, MAX_COMMENTS),
  };
}

const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** Editors that belong to `post`: inside it, or in the post dialog that shows it. */
function postEditors(post: Element): HTMLElement[] {
  const dialog = post.closest('[role="dialog"]');
  const scope = dialog ?? post;
  return [...scope.querySelectorAll<HTMLElement>(EDITOR)].filter((editor) => isVisible(editor) && (dialog || post.contains(editor)));
}

/**
 * The post's own comment box. Reply boxes open inside a comment thread and sit
 * deeper in the DOM than the post's box (both in feeds and in post dialogs,
 * checked 2026-10-12), so it is the shallowest box not known to answer a comment.
 */
function mainEditor(post: Element): HTMLElement | null {
  const candidates = postEditors(post).filter((editor) => !boxAddressee.has(editor));
  let best: HTMLElement | null = null;
  for (const editor of candidates) if (!best || domDepth(editor) <= domDepth(best)) best = editor;
  return best;
}

/** Reply boxes that can belong to a thread: after its head and before the next top-level comment. */
function threadEditors(head: Element, post: Element): HTMLElement[] {
  const tops = topLevelComments(post);
  const next = tops[tops.indexOf(head) + 1];
  const main = mainEditor(post);
  return postEditors(post).filter((editor) => editor !== main && follows(head, editor) && (!next || follows(editor, next)));
}

/** The post dialog Facebook opens for a permalink or a comment button, if any. */
function postDialog(doc: Document): Element | null {
  return [...doc.querySelectorAll('[role="dialog"]')].reverse().find((dialog) => [...dialog.querySelectorAll(ARTICLE)].some(isPost)) ?? null;
}

let lastPageKey: string | null = null;

function computePageKey(doc: Document): string | null {
  const url = new URL(doc.location?.href || 'https://www.facebook.com/');
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'groups' && segments[1]) return `groups/${segments[1]}`;
  if (segments[0] === 'permalink.php' || segments[0] === 'story.php') return url.searchParams.get('id') ?? url.searchParams.get('story_fbid');
  if (segments.length === 0) return 'home';
  return segments[0] ?? null;
}

/**
 * Which comment each reply box answers, learned from the operator's clicks: a
 * click inside a comment followed by focus moving into a box of the same thread
 * (Facebook focuses the box its Reply button opens or reuses).
 */
const boxAddressee = new WeakMap<Element, Element>();
const REPLY_FOCUS_WINDOW_MS = 3000;

function addressedByName(editor: Element, comment: Element, thread: Element[]): boolean {
  const name = authorOf(comment);
  if (!name) return false;
  // A name shared by several comments in the thread cannot tell them apart.
  if (thread.filter((other) => authorOf(other) === name).length > 1) return false;
  const label = editor.getAttribute('aria-label') ?? editor.getAttribute('aria-placeholder') ?? '';
  return label.includes(name) || collapse(editor.textContent).startsWith(name);
}

export const facebookAdapter: PlatformAdapter = {
  id: 'facebook',
  matches: ['https://www.facebook.com/*'],

  findTranslatableUnits(root) {
    const posts = [...root.querySelectorAll(ARTICLE)].filter(isPost);
    const units: HTMLElement[] = [];
    for (const post of posts) {
      const message = [...post.querySelectorAll<HTMLElement>(MESSAGE)].find((candidate) => candidate.closest(ARTICLE) === post);
      if (message) units.push(message);
      for (const comment of commentsOf(post)) units.push(...commentBodies(comment).slice(0, 1));
    }
    return units;
  },

  extractText(unit) {
    const article = unit.closest(ARTICLE);
    // A comment unit is its first text block; translate the whole comment.
    return article && isComment(article) ? commentText(article) : fbText(unit);
  },

  findReplyTargets(root) {
    const doc = root instanceof Document ? root : (root as Node).ownerDocument;
    const posts = [...root.querySelectorAll<HTMLElement>(ARTICLE)].filter(isPost);
    const dialog = doc ? postDialog(doc) : null;
    // A post opened in a dialog comes first, so getThreadContext answers with it.
    posts.sort((a, b) => Number(!!dialog?.contains(b)) - Number(!!dialog?.contains(a)));
    return posts.flatMap((post) => [post, ...(commentsOf(post) as HTMLElement[])]);
  },

  extractThread(target) {
    return threadOf(target);
  },

  findComposer(target) {
    if (!target) return null;
    const post = isPost(target) ? target : postOf(target);
    if (!post) return null;
    if (target === post) return mainEditor(post);
    const head = threadHead(target, post);
    if (!head) return null;
    const thread = threadComments(head, post);
    const inThread = threadEditors(head, post);
    const learned = inThread.find((editor) => boxAddressee.get(editor) === target);
    if (learned) return learned;
    // Without a click to go by, fall back to the name Facebook puts in the box, if it is unambiguous.
    return inThread.find((editor) => !boxAddressee.has(editor) && addressedByName(editor, target, thread)) ?? null;
  },

  attach(doc) {
    let lastClick: { comment: Element; at: number } | null = null;
    const onClick = (event: Event) => {
      const element = event.target instanceof Element ? event.target : null;
      const article = element?.closest(ARTICLE);
      lastClick = article && isComment(article) ? { comment: article, at: Date.now() } : null;
    };
    const onFocus = (event: Event) => {
      const editor = event.target instanceof Element ? event.target.closest(EDITOR) : null;
      if (!editor || !lastClick || Date.now() - lastClick.at > REPLY_FOCUS_WINDOW_MS) return;
      const post = postOf(lastClick.comment);
      const head = post && threadHead(lastClick.comment, post);
      if (post && head && threadEditors(head, post).includes(editor as HTMLElement)) boxAddressee.set(editor, lastClick.comment);
    };
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('focusin', onFocus, true);
    return () => {
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('focusin', onFocus, true);
    };
  },

  insertText(composer, text) {
    // In a comment box a line break can act like Enter and post the comment, so the draft goes in as one line.
    return insertIntoRichEditor(composer, text, { singleLine: true });
  },

  pageKey(doc) {
    // A post dialog over the page keeps the page's key, like X's reply dialog.
    if (postDialog(doc) && lastPageKey !== null) return lastPageKey;
    lastPageKey = computePageKey(doc);
    return lastPageKey;
  },

  findAds(root) {
    // Sponsored posts link to Facebook's ad explanation. Not yet observed on a real page.
    return [...root.querySelectorAll<HTMLElement>(ARTICLE)].filter((article) => isPost(article) && !!article.querySelector('a[href*="/ads/about"]'));
  },

  constraints: {},
};
