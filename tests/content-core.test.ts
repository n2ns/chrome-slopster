import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { redditAdapter } from '@/src/adapters/reddit';
import { runContentScript } from '@/src/content-core';
import { registerHandlers, sendToTab, type BackgroundMessages } from '@/src/messaging/protocol';
import { adBlockItem } from '@/src/storage/items';
import { DEFAULT_AD_BLOCK } from '@/src/storage/types';
import { mockI18n } from './helpers/browser';

type SelectHandler = (payload: BackgroundMessages['selectReplyTarget']['request']) => Promise<{ sidePanelOpened: boolean }>;

const FIXTURE = readFileSync(join(import.meta.dirname, 'fixtures', 'reddit', 'post-page.html'), 'utf8');

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function fakeContext() {
  const invalidated: (() => void)[] = [];
  return {
    isValid: true,
    setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
    onInvalidated: (fn: () => void) => invalidated.push(fn),
    addEventListener: (target: EventTarget, type: string, listener: EventListener) => {
      target.addEventListener(type, listener);
      invalidated.push(() => target.removeEventListener(type, listener));
    },
    invalidate: () => invalidated.forEach((fn) => fn()),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const toolbarButton = (host: Element, action: string) => host.shadowRoot!.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
const comment = (id: string) => document.querySelector<HTMLElement>(`shreddit-comment[thingid="${id}"]`)!;
const ownToolbar = (target: Element) => [...target.querySelectorAll('[data-sra-toolbar]')].find((host) => host.closest(target.tagName) === target)!;

describe('content core startup', () => {
  it('clears any reply target left from a previous page in this tab', async () => {
    fakeBrowser.reset();
    mockI18n();
    vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver);
    const clearReplyTarget = vi.fn(async () => ({}));
    registerHandlers<BackgroundMessages>({ clearReplyTarget });
    const ctx = fakeContext();
    runContentScript(redditAdapter, ctx as unknown as ContentScriptContext);
    await vi.waitFor(() => expect(clearReplyTarget).toHaveBeenCalledTimes(1));
    ctx.invalidate();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});

describe('content core on a Reddit post page', () => {
  let ctx: ReturnType<typeof fakeContext>;

  beforeEach(async () => {
    fakeBrowser.reset();
    mockI18n();
    vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver);
    // fakeBrowser has no tabs.sendMessage; deliver to this page's listeners like Chrome does.
    vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockImplementation(((_tabId: number, message: unknown) => fakeBrowser.runtime.sendMessage(message)) as never);
    window.history.replaceState(null, '', '/r/selfhosted/comments/1x3m5xo/why_selfhost/');
    document.body.innerHTML = FIXTURE;
    ctx = fakeContext();
    runContentScript(redditAdapter, ctx as unknown as ContentScriptContext);
    await flush();
  });
  afterEach(() => {
    ctx.invalidate();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('adds one toolbar per unit and a reply button per target, on the post body rather than its title', () => {
    const units = redditAdapter.findTranslatableUnits(document);
    expect(document.querySelectorAll('[data-sra-toolbar]')).toHaveLength(units.length);
    const replyHosts = [...document.querySelectorAll('[data-sra-toolbar]')].filter((host) => toolbarButton(host, 'reply'));
    expect(replyHosts).toHaveLength(redditAdapter.findReplyTargets(document).length);
    const titleHost = document.querySelector('shreddit-post [slot="title"]')!.nextElementSibling!;
    expect(toolbarButton(titleHost, 'reply')).toBeNull();
  });

  it('does not add duplicate toolbars when the page changes', async () => {
    const before = document.querySelectorAll('[data-sra-toolbar]').length;
    document.body.append(document.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(document.querySelectorAll('[data-sra-toolbar]')).toHaveLength(before);
  });

  it('translates a unit, then hides and shows the translation on later clicks', async () => {
    const translate = vi.fn(async ({ text }: { text: string }) => ({ text: `T:${text.slice(0, 7)}`, truncated: false }));
    registerHandlers<BackgroundMessages>({ translate });
    const host = ownToolbar(comment('t1_pfccwzm'));
    toolbarButton(host, 'translate')!.click();
    await vi.waitFor(() => expect(host.shadowRoot!.querySelector('.output')!.textContent).toBe('T:Because'));
    expect(translate).toHaveBeenCalledTimes(1);

    toolbarButton(host, 'translate')!.click();
    expect(host.shadowRoot!.querySelector<HTMLElement>('.output')!.hidden).toBe(true);
    toolbarButton(host, 'translate')!.click();
    await vi.waitFor(() => expect(host.shadowRoot!.querySelector<HTMLElement>('.output')!.hidden).toBe(false));
  });

  it('shows a localized error when translation fails', async () => {
    registerHandlers<BackgroundMessages>({
      translate: async () => {
        throw new Error('boom');
      },
    });
    const host = ownToolbar(comment('t1_pfccwzm'));
    toolbarButton(host, 'translate')!.click();
    await vi.waitFor(() => expect(host.shadowRoot!.querySelector('.output.error')!.textContent).toBe('errorGeneric'));
  });

  it('sends the selected comment as the reply target and remembers it for filling', async () => {
    const selectReplyTarget = vi.fn<SelectHandler>(async () => ({ sidePanelOpened: false }));
    registerHandlers<BackgroundMessages>({ selectReplyTarget });
    const target = comment('t1_pfccwzm');
    const host = ownToolbar(target);
    toolbarButton(host, 'reply')!.click();
    await vi.waitFor(() => expect(host.shadowRoot!.querySelector('.note')!.textContent).toBe('contentOpenSidePanel'));
    expect(selectReplyTarget.mock.calls[0]![0]).toMatchObject({ thread: { author: 'Beautiful_Ad_4813' } });
    expect(toolbarButton(host, 'reply')!.getAttribute('aria-pressed')).toBe('true');

    const insert = vi.spyOn(redditAdapter, 'insertText').mockResolvedValue({ ok: true });
    const thread = redditAdapter.extractThread(target);
    await expect(sendToTab(1, 'insertText', { text: 'hello', thread })).resolves.toEqual({ ok: true });
    expect(insert.mock.calls[0]![0].closest('shreddit-comment')).toBe(target);
  });

  it("fills a post draft into the main composer even after a comment with an open reply box was selected", async () => {
    registerHandlers<BackgroundMessages>({ selectReplyTarget: async () => ({ sidePanelOpened: true }) });
    toolbarButton(ownToolbar(comment('t1_pfccwzm')), 'reply')!.click();
    await flush();
    const insert = vi.spyOn(redditAdapter, 'insertText').mockResolvedValue({ ok: true });
    const { thread } = await sendToTab(1, 'getThreadContext', {});
    await expect(sendToTab(1, 'insertText', { text: 'hello', thread: thread! })).resolves.toEqual({ ok: true });
    const composer = insert.mock.calls[0]![0];
    expect(composer.closest('shreddit-comment')).toBeNull();
    expect(composer.closest('comment-body-header')).not.toBeNull();
  });

  it('reports not-found when the draft belongs to a thread that is not on this page', async () => {
    const thread = { ...redditAdapter.extractThread(comment('t1_pfccwzm')), url: 'https://www.reddit.com/r/other/comments/zzz/comment/q/' };
    await expect(sendToTab(1, 'insertText', { text: 'hello', thread })).resolves.toEqual({ ok: false, reason: 'not-found' });
  });

  it('reports not-found when the selected comment has no open reply box', async () => {
    const thread = redditAdapter.extractThread(comment('t1_pfcb65f'));
    await expect(sendToTab(1, 'insertText', { text: 'hello', thread })).resolves.toEqual({ ok: false, reason: 'not-found' });
  });

  it('clears the tab target when the page navigates to another post', async () => {
    const clearReplyTarget = vi.fn(async () => ({}));
    registerHandlers<BackgroundMessages>({ selectReplyTarget: async () => ({ sidePanelOpened: true }), clearReplyTarget });
    toolbarButton(ownToolbar(comment('t1_pfccwzm')), 'reply')!.click();
    await flush();
    clearReplyTarget.mockClear();
    window.history.pushState(null, '', '/r/selfhosted/comments/zzz999/other_post/');
    document.body.append(document.createElement('div'));
    await vi.waitFor(() => expect(clearReplyTarget).toHaveBeenCalledTimes(1));
  });

  it('keeps the tab target when the selected element is only unmounted (virtualized lists)', async () => {
    const clearReplyTarget = vi.fn(async () => ({}));
    registerHandlers<BackgroundMessages>({ selectReplyTarget: async () => ({ sidePanelOpened: true }), clearReplyTarget });
    const target = comment('t1_pfccwzm');
    toolbarButton(ownToolbar(target), 'reply')!.click();
    await flush();
    clearReplyTarget.mockClear();
    target.remove();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(clearReplyTarget).not.toHaveBeenCalled();
  });

  it('clears the tab target when the page is restored from the back/forward cache', async () => {
    const clearReplyTarget = vi.fn(async () => ({}));
    registerHandlers<BackgroundMessages>({ clearReplyTarget });
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    await vi.waitFor(() => expect(clearReplyTarget).toHaveBeenCalledTimes(1));
  });

  it('reports no new-post target on a post page, and refuses to fill a post there', async () => {
    await expect(sendToTab(1, 'getPostTarget', {})).resolves.toEqual({ target: null });
    const target = { kind: 'post' as const, platform: 'reddit' as const, url: `${location.origin}/r/selfhosted/submit/`, body: '', parentChain: [], comments: [] };
    await expect(sendToTab(1, 'insertPost', { title: 'T', body: 'B', target })).resolves.toEqual({ ok: false, reason: 'not-found' });
  });

  it('answers getThreadContext with the post', async () => {
    const { thread } = await sendToTab(1, 'getThreadContext', {});
    expect(thread).toMatchObject({ platform: 'reddit', title: 'Why Selfhost?' });
  });

  it('hides ads while the platform toggle is on', async () => {
    const ad = document.querySelector('shreddit-comments-page-ad')!;
    expect(ad.hasAttribute('data-sra-hidden-ad')).toBe(false);
    await adBlockItem.setValue({ ...DEFAULT_AD_BLOCK, reddit: true });
    await vi.waitFor(() => expect(ad.hasAttribute('data-sra-hidden-ad')).toBe(true));
    await adBlockItem.setValue({ ...DEFAULT_AD_BLOCK, reddit: false });
    await vi.waitFor(() => expect(ad.hasAttribute('data-sra-hidden-ad')).toBe(false));
  });
});
