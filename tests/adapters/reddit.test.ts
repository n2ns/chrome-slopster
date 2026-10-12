import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { redditAdapter } from '@/src/adapters/reddit';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures', 'reddit');

function load(name: string, path: string): void {
  window.history.replaceState(null, '', path);
  document.body.innerHTML = readFileSync(join(FIXTURES, name), 'utf8');
}

const comment = (id: string) => document.querySelector<HTMLElement>(`shreddit-comment[thingid="${id}"]`)!;

describe('reddit adapter on a post page', () => {
  beforeEach(() => load('post-page.html', '/r/selfhosted/comments/1x3m5xo/why_selfhost/'));
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('finds the title, the body, and every comment body as translatable units', () => {
    const units = redditAdapter.findTranslatableUnits(document);
    const slots = units.map((unit) => unit.getAttribute('slot'));
    expect(slots).toContain('title');
    expect(slots).toContain('text-body');
    expect(slots.filter((slot) => slot === 'comment')).toHaveLength(document.querySelectorAll('shreddit-comment').length);
  });

  it('extracts comment text paragraph by paragraph', () => {
    const body = [...comment('t1_pfccwzm').querySelectorAll('[slot="comment"]')].find((el) => el.closest('shreddit-comment') === comment('t1_pfccwzm'))!;
    const text = redditAdapter.extractText(body as HTMLElement);
    expect(text.startsWith('Because at any time, Google')).toBe(true);
    expect(text).toContain('\n\n');
    expect(text).not.toMatch(/ {2}/);
  });

  it('offers the post and every comment as reply targets', () => {
    const targets = redditAdapter.findReplyTargets(document);
    expect(targets[0]!.tagName.toLowerCase()).toBe('shreddit-post');
    expect(targets).toHaveLength(1 + document.querySelectorAll('shreddit-comment').length);
  });

  it('extracts the post context', () => {
    const thread = redditAdapter.extractThread(document.querySelector<HTMLElement>('shreddit-post')!);
    expect(thread).toMatchObject({
      kind: 'post',
      platform: 'reddit',
      url: `${location.origin}/r/selfhosted/comments/1x3m5xo/why_selfhost/`,
      community: 'r/selfhosted',
      title: 'Why Selfhost?',
      parentChain: [],
    });
    expect(thread.body).toMatch(/^I'm curious, why is it that you guys migrated/);
    expect(thread.comments.length).toBeGreaterThan(0);
    expect(thread.comments.length).toBeLessThanOrEqual(5);
  });

  it('extracts a nested comment with its ancestors (nearest first) and the post body last', () => {
    const thread = redditAdapter.extractThread(comment('t1_pfcdi8b'));
    expect(thread.kind).toBe('comment');
    expect(thread.author).toBe('Elgon2003');
    expect(thread.title).toBe('Why Selfhost?');
    expect(thread.body).toMatch(/subscriptions/);
    expect(thread.parentChain).toHaveLength(3);
    expect(thread.parentChain[0]).toMatch(/^Cheaper\?/);
    expect(thread.parentChain[2]).toMatch(/^I'm curious/);
    expect(thread.url).toContain('/r/selfhosted/comments/1x3m5xo/comment/');
  });

  it('lists only direct replies of a comment as its existing replies', () => {
    const thread = redditAdapter.extractThread(comment('t1_pfccb6a'));
    expect(thread.comments).toEqual([expect.stringMatching(/^Cheaper\?/)]);
  });

  it("finds a comment's own reply box, and the main composer for the post", () => {
    const opened = comment('t1_pfccwzm');
    const own = redditAdapter.findComposer(opened)!;
    expect(own.closest('shreddit-comment')).toBe(opened);
    const main = redditAdapter.findComposer(document.querySelector<HTMLElement>('shreddit-post')!)!;
    expect(main.closest('shreddit-comment')).toBeNull();
    expect(main.closest('comment-body-header')).not.toBeNull();
  });

  it('returns null for a comment whose reply box is not open', () => {
    expect(redditAdapter.findComposer(comment('t1_pfcb65f'))).toBeNull();
  });

  it('finds the in-thread ad', () => {
    expect(redditAdapter.findAds(document).map((ad) => ad.tagName.toLowerCase())).toEqual(['shreddit-comments-page-ad']);
  });
});

describe('reddit adapter on a feed', () => {
  beforeEach(() => load('feed.html', '/r/selfhosted/'));

  it('translates feed titles but offers no reply targets', () => {
    expect(redditAdapter.findTranslatableUnits(document).length).toBeGreaterThanOrEqual(3);
    expect(redditAdapter.findReplyTargets(document)).toEqual([]);
  });

  it('finds the promoted post', () => {
    expect(redditAdapter.findAds(document).map((ad) => ad.tagName.toLowerCase())).toEqual(['shreddit-ad-post']);
  });
});
