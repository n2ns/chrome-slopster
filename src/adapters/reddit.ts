// Reddit (new "shreddit" UI). Selectors rely on Reddit's custom elements and
// slot names, never on utility class names. Fixtures: tests/fixtures/reddit.

import { blockText, insertIntoRichEditor, isVisible } from './dom';
import type { PlatformAdapter, ThreadContext } from './types';

const UNIT_SELECTOR = 'shreddit-post [slot="title"], shreddit-post [slot="text-body"], shreddit-comment [slot="comment"]';
const EDITOR_SELECTOR = '[contenteditable="true"][role="textbox"]';
const AD_SELECTOR = 'shreddit-ad-post, shreddit-comments-page-ad';
const MAX_COMMENTS = 5;

function isPostPage(doc: Document): boolean {
  return /^\/r\/[^/]+\/comments\//.test(doc.location?.pathname ?? '');
}

function absoluteUrl(doc: Document, path: string | null): string {
  if (!path) return doc.location?.href ?? '';
  try {
    return new URL(path, doc.location?.origin || 'https://www.reddit.com').href;
  } catch {
    return doc.location?.href ?? '';
  }
}

/** The comment's own body, not one of its nested replies. */
function ownCommentBody(comment: Element): Element | undefined {
  return [...comment.querySelectorAll('[slot="comment"]')].find((body) => body.closest('shreddit-comment') === comment);
}

function postTitle(post: Element): string {
  return post.getAttribute('post-title') || blockText(post.querySelector('[slot="title"]') ?? post);
}

function postBody(post: Element): string {
  const body = post.querySelector('[slot="text-body"]');
  return body ? blockText(body) : '';
}

function commentText(comment: Element): string {
  const body = ownCommentBody(comment);
  return body ? blockText(body) : '';
}

function topLevelComments(doc: Document): string[] {
  return [...doc.querySelectorAll('shreddit-comment[depth="0"]')].map(commentText).filter(Boolean).slice(0, MAX_COMMENTS);
}

function postContext(post: Element): ThreadContext {
  const doc = post.ownerDocument;
  return {
    kind: 'post',
    platform: 'reddit',
    url: absoluteUrl(doc, post.getAttribute('permalink')),
    community: post.getAttribute('subreddit-prefixed-name') ?? undefined,
    author: post.getAttribute('author') ?? undefined,
    title: postTitle(post),
    body: postBody(post),
    parentChain: [],
    comments: topLevelComments(doc),
  };
}

function commentContext(comment: Element): ThreadContext {
  const doc = comment.ownerDocument;
  const post = doc.querySelector('shreddit-post');
  const ancestors: string[] = [];
  for (let parent = comment.parentElement?.closest('shreddit-comment'); parent; parent = parent.parentElement?.closest('shreddit-comment')) {
    const text = commentText(parent);
    if (text) ancestors.push(text);
  }
  const body = post ? postBody(post) : '';
  if (body) ancestors.push(body);
  const replies = [...comment.querySelectorAll('shreddit-comment')]
    .filter((reply) => reply.parentElement?.closest('shreddit-comment') === comment)
    .map(commentText)
    .filter(Boolean)
    .slice(0, MAX_COMMENTS);
  return {
    kind: 'comment',
    platform: 'reddit',
    url: absoluteUrl(doc, comment.getAttribute('permalink')),
    community: post?.getAttribute('subreddit-prefixed-name') ?? undefined,
    author: comment.getAttribute('author') ?? undefined,
    title: post ? postTitle(post) : undefined,
    body: commentText(comment),
    parentChain: ancestors,
    comments: replies,
  };
}

export const redditAdapter: PlatformAdapter = {
  id: 'reddit',
  matches: ['https://www.reddit.com/*', 'https://reddit.com/*'],

  findTranslatableUnits(root) {
    return [...root.querySelectorAll<HTMLElement>(UNIT_SELECTOR)];
  },

  extractText(unit) {
    return blockText(unit);
  },

  findReplyTargets(root) {
    // Replies are only possible on a post's own page.
    const doc = root instanceof Document ? root : (root as Node).ownerDocument;
    if (!doc || !isPostPage(doc)) return [];
    return [...root.querySelectorAll<HTMLElement>('shreddit-post, shreddit-comment')];
  },

  extractThread(target) {
    return target.tagName.toLowerCase() === 'shreddit-comment' ? commentContext(target) : postContext(target);
  },

  findComposer(target) {
    const doc = target?.ownerDocument ?? document;
    const editors = [...doc.querySelectorAll<HTMLElement>(EDITOR_SELECTOR)].filter(isVisible);
    const focused = editors.find((editor) => editor === doc.activeElement || editor.contains(doc.activeElement));
    if (target?.tagName.toLowerCase() === 'shreddit-comment') {
      // A comment's reply box opens inside the comment, above its nested replies.
      return editors.find((editor) => editor.closest('shreddit-comment') === target) ?? null;
    }
    if (target) {
      // The post's reply box is the main composer outside every comment.
      return editors.find((editor) => !editor.closest('shreddit-comment')) ?? null;
    }
    return focused ?? editors[0] ?? null;
  },

  insertText(composer, text) {
    return insertIntoRichEditor(composer, text);
  },

  findAds(root) {
    return [...root.querySelectorAll<HTMLElement>(AD_SELECTOR)];
  },

  constraints: {},
};
