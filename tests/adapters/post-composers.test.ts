import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { facebookAdapter } from '@/src/adapters/facebook';
import { redditAdapter } from '@/src/adapters/reddit';
import { xAdapter } from '@/src/adapters/x';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

function load(path: string, ...files: string[]): void {
  window.history.replaceState(null, '', path);
  document.body.innerHTML = files.map((file) => readFileSync(join(FIXTURES, file), 'utf8')).join('\n');
}

/** Serialization drops shadow roots; rebuild the title textarea Reddit keeps in one. */
function attachRedditTitle(): HTMLTextAreaElement {
  const host = document.querySelector('post-composer-title')!;
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  root.innerHTML = '<textarea name="title"></textarea>';
  return root.querySelector('textarea')!;
}

afterEach(() => {
  document.body.innerHTML = '';
  document.title = '';
});

describe('reddit new-post form', () => {
  it('targets the subreddit of the submit page and finds the title and body fields', () => {
    load('/r/selfhosted/submit/', 'reddit/submit.html');
    const title = attachRedditTitle();
    expect(redditAdapter.postTarget(document)).toMatchObject({ kind: 'post', platform: 'reddit', community: 'r/selfhosted', url: `${location.origin}/r/selfhosted/submit/` });
    const composer = redditAdapter.findPostComposer(document)!;
    expect(composer.title).toBe(title);
    expect(composer.body.closest('shreddit-composer')?.getAttribute('name')).toBe('body');
  });

  it('refuses to fill without a title, leaving the form untouched', async () => {
    load('/r/selfhosted/submit/', 'reddit/submit.html');
    const title = attachRedditTitle();
    const composer = redditAdapter.findPostComposer(document)!;
    await expect(redditAdapter.insertPost(composer, { body: 'Body only' })).resolves.toEqual({ ok: false, reason: 'rejected' });
    expect(title.value).toBe('');
    expect(composer.body.textContent).not.toContain('Body only');
  });

  it('has no new-post form on a post page', () => {
    load('/r/selfhosted/comments/1x3m5xo/why_selfhost/', 'reddit/post-page.html');
    expect(redditAdapter.postTarget(document)).toBeNull();
  });
});

describe('x new-post form', () => {
  it("uses the timeline's inline composer", () => {
    load('/home', 'x/home-composer.html');
    expect(xAdapter.postTarget(document)).toMatchObject({ kind: 'post', platform: 'x', url: `${location.origin}/home` });
    expect(xAdapter.findPostComposer(document)?.body.getAttribute('data-testid')).toBe('tweetTextarea_0');
  });

  it('offers no new-post form while a reply dialog covers the timeline composer', () => {
    load('/home', 'x/home-composer.html', 'x/reply-dialog.html');
    expect(xAdapter.postTarget(document)).toBeNull();
    window.history.replaceState(null, '', '/compose/post');
    expect(xAdapter.postTarget(document)).toBeNull();
  });

  it('does not treat the reply box of a status page or a reply dialog as a new-post form', () => {
    load('/DNetwork_4/status/2109314061410120106', 'x/status.html');
    expect(xAdapter.postTarget(document)).toBeNull();
    load('/DNetwork_4/status/2109314061410120106', 'x/status.html', 'x/reply-dialog.html');
    window.history.replaceState(null, '', '/compose/post');
    expect(xAdapter.findPostComposer(document)).toBeNull();
  });
});

describe('facebook new-post form', () => {
  it('uses the Create post dialog and names the group from the page title', () => {
    load('/groups/333250224984388/', 'facebook/create-post-dialog.html');
    document.title = '(2) Vietnam Travelers | Facebook';
    expect(facebookAdapter.postTarget(document)).toMatchObject({ kind: 'post', platform: 'facebook', community: 'Vietnam Travelers' });
    expect(facebookAdapter.findPostComposer(document)?.body.getAttribute('aria-placeholder')).toBe('发布公开帖…');
  });

  it('does not treat other dialogs with a text box as Create post (e.g. editing an existing post)', () => {
    load('/groups/333250224984388/');
    document.body.innerHTML = '<div role="dialog" aria-label="Edit post"><form method="POST"><div role="textbox" contenteditable="true">existing text</div></form></div>';
    expect(facebookAdapter.postTarget(document)).toBeNull();
    document.body.innerHTML = '<div role="dialog"><div role="textbox" contenteditable="true"></div></div>';
    expect(facebookAdapter.postTarget(document)).toBeNull();
  });

  it('refuses to fill a Create post editor that already has text', async () => {
    load('/groups/333250224984388/', 'facebook/create-post-dialog.html');
    const composer = facebookAdapter.findPostComposer(document)!;
    composer.body.textContent = 'typed by the operator';
    expect(facebookAdapter.findPostComposer(document)).toBeNull();
  });

  it('names no community on the home feed', () => {
    load('/', 'facebook/create-post-dialog.html');
    document.title = '(3) Facebook';
    expect(facebookAdapter.postTarget(document)?.community).toBeUndefined();
  });

  it('does not treat a post dialog with comments as a new-post form', () => {
    load('/AnhTraiVuotNganChongGai/posts/x', 'facebook/post-dialog.html');
    expect(facebookAdapter.postTarget(document)).toBeNull();
  });
});
