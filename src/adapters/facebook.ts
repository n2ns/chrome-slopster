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

function depth(article: Element): number {
  let count = 0;
  for (let parent = parentArticle(article); parent; parent = parentArticle(parent)) count += 1;
  return count;
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

/** The comment's own text blocks (outermost dir="auto" blocks not inside a nested reply). */
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

function postUrl(post: Element): string {
  const doc = post.ownerDocument;
  const link = [...post.querySelectorAll<HTMLAnchorElement>(POST_LINK)].find((anchor) => anchor.closest(ARTICLE) === post);
  const url = absolute(doc, link?.getAttribute('href'));
  if (!url) return doc.location?.href ?? '';
  const parsed = new URL(url);
  parsed.search = '';
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

function commentsOf(post: Element): Element[] {
  return [...post.querySelectorAll(ARTICLE)].filter(isComment);
}

function directReplies(article: Element): Element[] {
  const post = isPost(article) ? article : postOf(article);
  return post ? commentsOf(post).filter((comment) => parentArticle(comment) === article) : [];
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

function threadOf(target: Element): ThreadContext {
  const doc = target.ownerDocument;
  if (isPost(target)) {
    return {
      kind: 'post',
      platform: 'facebook',
      url: postUrl(target),
      author: authorOf(target),
      body: postText(target),
      parentChain: [],
      comments: directReplies(target).map(commentText).filter(Boolean).slice(0, MAX_COMMENTS),
    };
  }
  const post = postOf(target);
  const ancestors: string[] = [];
  for (let parent = parentArticle(target); parent && parent !== post; parent = parentArticle(parent)) {
    const text = commentText(parent);
    if (text) ancestors.push(text);
  }
  const body = post ? postText(post) : '';
  if (body) ancestors.push(body);
  const id = commentId(target);
  const base = post ? postUrl(post) : (doc.location?.href ?? '');
  return {
    kind: 'comment',
    platform: 'facebook',
    url: id ? `${base}?comment_id=${encodeURIComponent(id)}` : base,
    author: authorOf(target),
    body: commentText(target),
    parentChain: ancestors,
    comments: directReplies(target).map(commentText).filter(Boolean).slice(0, MAX_COMMENTS),
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
 * Whether a reply box addresses the comment's author: by its label ("Reply to
 * Name…") or, where the label has no name (group posts: "Write a public
 * reply…"), by the mention Facebook prefills when Reply is clicked.
 */
function mentionsAuthor(editor: Element, comment: Element): boolean {
  const name = authorOf(comment);
  if (!name) return false;
  const label = editor.getAttribute('aria-label') ?? editor.getAttribute('aria-placeholder') ?? '';
  return label.includes(name.slice(0, 12)) || collapse(editor.textContent).startsWith(name);
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
    const editors = postEditors(post);
    const comments = commentsOf(post);
    if (target === post) {
      // The post's own box is the one not addressed to any commenter.
      return editors.find((editor) => !comments.some((comment) => mentionsAuthor(editor, comment))) ?? null;
    }
    // A reply box opens after the comment's thread, before the next comment at the same or a shallower level.
    const level = depth(target);
    const next = comments.find((comment) => follows(target, comment) && !target.contains(comment) && depth(comment) <= level);
    return (
      editors.find((editor) => follows(target, editor) && (!next || follows(editor, next)) && mentionsAuthor(editor, target)) ?? null
    );
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
