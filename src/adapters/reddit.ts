// Reddit (new "shreddit" UI). Selectors rely on Reddit's custom elements and
// slot names, never on utility class names. Fixtures: tests/fixtures/reddit.

import { blockText, fillTextField, insertIntoRichEditor, isVisible } from './dom';
import type { PlatformAdapter, PostComposer, ThreadContext } from './types';

const UNIT_SELECTOR = 'shreddit-post [slot="title"], shreddit-post [slot="text-body"], shreddit-comment [slot="comment"]';
const EDITOR_SELECTOR = '[contenteditable="true"][role="textbox"]';
const AD_SELECTOR = 'shreddit-ad-post, shreddit-comments-page-ad';
const MAX_COMMENTS = 5;

function postId(doc: Document): string | null {
  return /^\/r\/[^/]+\/comments\/([^/]+)/.exec(doc.location?.pathname ?? '')?.[1] ?? null;
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

/** The submit page's form: Lexical body editor and the title textarea inside <post-composer-title>'s shadow root. */
function postComposer(doc: Document): PostComposer | null {
  const form = doc.querySelector('r-post-composer-form');
  const body = form?.querySelector<HTMLElement>('shreddit-composer[name="body"] [contenteditable="true"][role="textbox"]');
  const title = form?.querySelector('post-composer-title')?.shadowRoot?.querySelector<HTMLTextAreaElement>('textarea[name="title"]');
  return body && isVisible(body) ? { body, title: title ?? undefined } : null;
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
    if (!doc || !postId(doc)) return [];
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

  pageKey(doc) {
    return postId(doc);
  },

  postTarget(doc) {
    if (!postComposer(doc)) return null;
    const subreddit = /^\/r\/([^/]+)\/submit/.exec(doc.location?.pathname ?? '')?.[1];
    return {
      kind: 'post',
      platform: 'reddit',
      url: `${doc.location?.origin ?? ''}${doc.location?.pathname ?? ''}`,
      community: subreddit ? `r/${subreddit}` : undefined,
      body: '',
      parentChain: [],
      comments: [],
    };
  },

  findPostComposer(doc) {
    return postComposer(doc);
  },

  async insertPost(composer, draft) {
    // Reddit requires a title; never fill a body under a missing or rejected title.
    if (!composer.title || !draft.title) return { ok: false, reason: 'rejected' };
    const title = fillTextField(composer.title as HTMLTextAreaElement, draft.title);
    if (!title.ok) return title;
    return insertIntoRichEditor(composer.body, draft.body);
  },

  findAds(root) {
    return [...root.querySelectorAll<HTMLElement>(AD_SELECTOR)];
  },

  constraints: {},
};
