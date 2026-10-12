import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { xAdapter } from '@/src/adapters/x';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures', 'x');
const STATUS_PATH = '/DNetwork_4/status/2109314061410120106';

function load(path: string, ...files: string[]): void {
  window.history.replaceState(null, '', path);
  document.body.innerHTML = files.map((file) => readFileSync(join(FIXTURES, file), 'utf8')).join('\n');
}

const tweets = () => [...document.querySelectorAll<HTMLElement>('[data-testid="primaryColumn"] article[data-testid="tweet"]')];

describe('x adapter on a status page', () => {
  beforeEach(() => load(STATUS_PATH, 'status.html'));
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('finds the text of every tweet as a translatable unit', () => {
    expect(xAdapter.findTranslatableUnits(document)).toHaveLength(document.querySelectorAll('[data-testid="tweetText"]').length);
  });

  it('offers every tweet as a reply target, the focal tweet first', () => {
    const targets = xAdapter.findReplyTargets(document);
    expect(targets).toHaveLength(tweets().length);
    expect(targets[0]!.getAttribute('tabindex')).toBe('-1');
  });

  it('extracts the focal tweet as the post, with replies as existing comments', () => {
    const thread = xAdapter.extractThread(xAdapter.findReplyTargets(document)[0]!);
    expect(thread).toMatchObject({
      kind: 'post',
      platform: 'x',
      url: `${location.origin}${STATUS_PATH}`,
      author: '@DNetwork_4',
      body: 'Physics is real one word on this  engineering  techniques',
      parentChain: [],
    });
    expect(thread.comments[0]).toBe('I thought it was strong');
    expect(thread.comments.length).toBeLessThanOrEqual(5);
  });

  it('extracts a reply as a comment whose parent chain starts with the focal tweet', () => {
    const thread = xAdapter.extractThread(tweets()[1]!);
    expect(thread).toMatchObject({ kind: 'comment', author: '@Triumph_talez', body: 'I thought it was strong', comments: [] });
    expect(thread.parentChain[0]).toMatch(/^Physics is real/);
    expect(thread.url).toContain('/Triumph_talez/status/');
  });

  it('uses the inline composer for the focal tweet only', () => {
    const [focal, reply] = [tweets()[0]!, tweets()[1]!];
    expect(xAdapter.findComposer(focal)?.getAttribute('data-testid')).toBe('tweetTextarea_0');
    expect(xAdapter.findComposer(reply)).toBeNull();
  });

  it('caps replies at 280 characters', () => {
    expect(xAdapter.constraints.maxReplyLength).toBe(280);
  });
});

describe('x adapter with a reply dialog open', () => {
  // X moves to /compose/post while its reply dialog is open; the conversation stays behind it.
  beforeEach(() => {
    load(STATUS_PATH, 'status.html', 'reply-dialog.html');
    expect(xAdapter.pageKey(document)).toBe('2109314061410120106');
    window.history.replaceState(null, '', '/compose/post');
  });

  it('keeps the status page key while the dialog route is open', () => {
    expect(xAdapter.pageKey(document)).toBe('2109314061410120106');
  });

  it('still offers replies as targets when X has unmounted the focal tweet', () => {
    tweets()[0]!.closest('[data-testid="cellInnerDiv"]')!.remove();
    const targets = xAdapter.findReplyTargets(document);
    expect(targets.length).toBeGreaterThan(0);
    expect(xAdapter.findComposer(tweets()[0]!)?.closest('[role="dialog"]')).not.toBeNull();
  });

  it('does not match a dialog to another tweet by the same author with identical (or no) text', () => {
    const dialogTweet = document.querySelector('[role="dialog"] article')!;
    const other = tweets()[2]!;
    // Same author and same (empty) text as the dialog's tweet, but a different tweet (posted at another time).
    const handle = (tweet: Element) => tweet.querySelector('[data-testid="User-Name"]')!.textContent!.match(/@\w+/)![0];
    const name = other.querySelector('[data-testid="User-Name"]')!;
    name.innerHTML = name.innerHTML.replaceAll(handle(other), handle(dialogTweet));
    expect(handle(other)).toBe(handle(dialogTweet));
    other.querySelector('[data-testid="tweetText"]')?.remove();
    dialogTweet.querySelector('[data-testid="tweetText"]')?.remove();
    expect(xAdapter.findComposer(other)).toBeNull();
    expect(xAdapter.findComposer(tweets()[1]!)?.closest('[role="dialog"]')).not.toBeNull();
  });

  it('still offers the conversation as reply targets', () => {
    expect(xAdapter.findReplyTargets(document)).toHaveLength(tweets().length);
  });

  it('uses the dialog composer for the tweet the dialog answers', () => {
    const composer = xAdapter.findComposer(tweets()[1]!)!;
    expect(composer.closest('[role="dialog"]')).not.toBeNull();
  });

  it('does not use the dialog for a different tweet', () => {
    expect(xAdapter.findComposer(tweets()[2]!)).toBeNull();
  });

  it('ignores the quoted tweet inside the dialog as a unit or target', () => {
    expect(xAdapter.findTranslatableUnits(document).some((unit) => unit.closest('[role="dialog"]'))).toBe(false);
    expect(xAdapter.findReplyTargets(document).some((tweet) => tweet.closest('[role="dialog"]'))).toBe(false);
  });
});

describe('x adapter elsewhere', () => {
  it('has no page key off status pages', () => {
    load('/home');
    expect(xAdapter.pageKey(document)).toBeNull();
    window.history.replaceState(null, '', '/compose/post');
    expect(xAdapter.pageKey(document)).toBeNull();
  });

  it('offers no reply targets on a timeline, where no tweet is focal', () => {
    load('/home', 'status.html');
    // Timelines (home, profiles, search) render every tweet with tabindex="0" (checked 2026-10-12).
    document.querySelectorAll('article').forEach((tweet) => tweet.setAttribute('tabindex', '0'));
    expect(xAdapter.findReplyTargets(document)).toEqual([]);
  });

  it('keeps line breaks and emoji alt text in tweet text', () => {
    load('/home');
    document.body.innerHTML = '<div data-testid="tweetText"><span>Line one</span>\n<span>Line two </span><img alt="🔥"></div>';
    expect(xAdapter.extractText(document.querySelector<HTMLElement>('[data-testid="tweetText"]')!)).toBe('Line one\nLine two 🔥');
  });

  it('finds promoted tweets by their Ad label and hides the whole cell', () => {
    load('/home');
    document.body.innerHTML = `
      <div data-testid="cellInnerDiv"><article data-testid="tweet"><span>Ad</span><div data-testid="tweetText">Buy</div></article></div>
      <div data-testid="cellInnerDiv"><article data-testid="tweet"><div data-testid="tweetText"><a>#SuperBowl</a><span> Ad</span></div></article></div>
      <div data-testid="cellInnerDiv"><article data-testid="tweet"><div data-testid="User-Name"><span>Ad</span><span>@ad</span></div><div data-testid="tweetText">hi</div></article></div>`;
    const ads = xAdapter.findAds(document);
    expect(ads).toHaveLength(1);
    expect(ads[0]!.getAttribute('data-testid')).toBe('cellInnerDiv');
  });
});
