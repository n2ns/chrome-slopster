// Side panel new-post flow: mode switch, post target, generation payload, title, filling.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import SidepanelApp from '@/entrypoints/sidepanel/App';
import type { InsertResult, PostDraft, ThreadContext } from '@/src/adapters/types';
import { registerHandlers, type BackgroundMessages } from '@/src/messaging/protocol';
import type { GenerationRequest, GenerationResult } from '@/src/prompt/types';
import { settingsItem } from '@/src/storage/items';
import { getActivePersona } from '@/src/storage/personas';
import { DEFAULT_SETTINGS } from '@/src/storage/types';
import { installLocksPolyfill } from './helpers/browser';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAB_ID = 7;

const redditTarget: ThreadContext = {
  kind: 'post',
  platform: 'reddit',
  url: 'https://www.reddit.com/r/test/submit',
  community: 'r/test',
  body: '',
  parentChain: [],
  comments: [],
};

const xTarget: ThreadContext = { kind: 'post', platform: 'x', url: 'https://x.com/compose/post', body: '', parentChain: [], comments: [] };

const postResult: GenerationResult = {
  raw: '{}',
  parsed: { shouldReply: true, reason: 'Fits', title: 'Generated title', reply: 'Generated body', replyNative: 'Review copy', reviewNotes: 'Check facts' },
};

let root: Root;
let container: HTMLElement;
let contentReplies: { getPostTarget?: () => unknown; insertPost?: (payload: PostDraft & { target: ThreadContext }) => InsertResult };
let sentToTab: { tabId: number; type: string; payload: unknown }[];
let generateRequests: GenerationRequest[];

async function settle() {
  for (let i = 0; i < 5; i += 1) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

async function render() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<SidepanelApp />));
  await settle();
}

function setValue(element: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The post flow's own elements; the hidden reply flow stays mounted beside it. */
function postFlow(): HTMLElement {
  const flow = container.querySelector<HTMLElement>('#post-flow');
  if (!flow) throw new Error('No post flow');
  return flow;
}

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
  if (!found) throw new Error(`No button "${label}"`);
  return found;
}

async function click(label: string, scope?: ParentNode) {
  await act(async () => button(label, scope).click());
  await settle();
}

async function renderPostMode() {
  await render();
  await click('modePost');
}

function useGenerate(result: GenerationResult) {
  registerHandlers<BackgroundMessages>({
    generate: async (request) => {
      generateRequests.push(request);
      return result;
    },
  });
}

describe('side panel new-post flow', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    installLocksPolyfill();
    vi.spyOn(fakeBrowser.i18n, 'getMessage').mockImplementation(((key: string, subs?: string | string[]) =>
      subs === undefined ? key : `${key}(${([] as string[]).concat(subs).join(',')})`) as never);
    vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue('en');
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation((async () => [{ id: TAB_ID, url: redditTarget.url }]) as never);

    contentReplies = {};
    sentToTab = [];
    generateRequests = [];
    vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockImplementation((async (tabId: number, message: { type: string; payload: unknown }) => {
      sentToTab.push({ tabId, type: message.type, payload: message.payload });
      if (message.type === 'getPostTarget' && contentReplies.getPostTarget) {
        return { ok: true, data: contentReplies.getPostTarget() };
      }
      if (message.type === 'insertPost' && contentReplies.insertPost) {
        return { ok: true, data: contentReplies.insertPost(message.payload as PostDraft & { target: ThreadContext }) };
      }
      throw new Error('Could not establish connection. Receiving end does not exist.');
    }) as never);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('switches modes, sharing the intent and keeping each flow mounted', async () => {
    await render();
    const intent = container.querySelector<HTMLTextAreaElement>('#intent')!;
    expect(button('modeReply').getAttribute('aria-pressed')).toBe('true');
    expect(intent.placeholder).toBe('intentPlaceholder');
    expect(postFlow().hidden).toBe(true);

    await act(async () => setValue(intent, 'Ask about backups'));
    await click('modePost');
    expect(button('modePost').getAttribute('aria-pressed')).toBe('true');
    expect(intent.placeholder).toBe('postIntentPlaceholder');
    expect(intent.value).toBe('Ask about backups');
    expect(postFlow().hidden).toBe(false);
    expect(container.querySelector<HTMLElement>('#reply-flow')!.hidden).toBe(true);

    await click('modeReply');
    expect(postFlow().hidden).toBe(true);
  });

  it('asks the page for the post target on every generate and sends mode post with persona and intent', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, operatorLanguage: 'zh-CN' });
    useGenerate(postResult);
    contentReplies.getPostTarget = () => ({ target: redditTarget });
    await renderPostMode();
    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#intent')!, 'Ask about backups'));
    await click('generate', postFlow());

    expect(sentToTab).toEqual([{ tabId: TAB_ID, type: 'getPostTarget', payload: {} }]);
    expect(generateRequests).toEqual([
      { mode: 'post', thread: redditTarget, persona: await getActivePersona(), intent: 'Ask about backups', operatorLanguage: 'zh-CN' },
    ]);
    expect(postFlow().querySelector('.target-meta')!.textContent).toBe('replyPlatformReddit · r/test');
    expect(postFlow().querySelector('.verdict')!.textContent).toContain('postVerdictYes');
    expect(postFlow().querySelector('.native')!.textContent).toBe('Review copy');
    expect(postFlow().querySelector('.notes')!.textContent).toBe('Check facts');
    expect(postFlow().textContent).toContain('postManualPublishReminder');

    const other = { ...redditTarget, url: 'https://www.reddit.com/r/other/submit', community: 'r/other' };
    contentReplies.getPostTarget = () => ({ target: other });
    await click('generate', postFlow());
    expect(sentToTab.map((sent) => sent.type)).toEqual(['getPostTarget', 'getPostTarget']);
    expect(generateRequests.map((request) => request.thread.url)).toEqual([redditTarget.url, other.url]);
  });

  it('shows a hint when no new-post form is open or the page has no content script', async () => {
    useGenerate(postResult);
    await renderPostMode();
    await click('generate', postFlow());
    expect(postFlow().textContent).toContain('postNoTarget');

    contentReplies.getPostTarget = () => ({ target: null });
    await click('generate', postFlow());
    expect(postFlow().textContent).toContain('postNoTarget');
    expect(postFlow().querySelector('.target')).toBeNull();
    expect(generateRequests).toEqual([]);
  });

  it('requires an editable Reddit title and fills the edited title and body for the generation target', async () => {
    useGenerate(postResult);
    contentReplies.getPostTarget = () => ({ target: redditTarget });
    const fills: (PostDraft & { target: ThreadContext })[] = [];
    contentReplies.insertPost = (payload) => {
      fills.push(payload);
      return { ok: true };
    };
    await renderPostMode();
    await click('generate', postFlow());

    const title = container.querySelector<HTMLInputElement>('#post-title')!;
    expect(title.value).toBe('Generated title');
    expect(container.querySelector<HTMLTextAreaElement>('#post-draft')!.value).toBe('Generated body');

    await act(async () => setValue(title, '  '));
    expect(button('postFill').disabled).toBe(true);
    expect(postFlow().textContent).toContain('postTitleRequired');

    await act(async () => setValue(title, 'Edited title'));
    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#post-draft')!, 'Edited body'));
    // The page's form moved elsewhere after generating; the fill still names the draft's own target.
    contentReplies.getPostTarget = () => ({ target: { ...redditTarget, url: 'https://www.reddit.com/r/other/submit' } });
    await click('postFill');

    expect(fills).toEqual([{ title: 'Edited title', body: 'Edited body', target: redditTarget }]);
    expect(postFlow().querySelector('.status')!.textContent).toBe('postFilled');
  });

  it('copies the Reddit title and body separated by a blank line', async () => {
    useGenerate(postResult);
    contentReplies.getPostTarget = () => ({ target: redditTarget });
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderPostMode();
    await click('generate', postFlow());
    await click('replyCopy', postFlow());
    expect(writeText).toHaveBeenCalledWith('Generated title\n\nGenerated body');
  });

  it('reports fill failures', async () => {
    useGenerate(postResult);
    contentReplies.getPostTarget = () => ({ target: redditTarget });
    const reasons: InsertResult[] = [
      { ok: false, reason: 'not-found' },
      { ok: false, reason: 'rejected' },
    ];
    contentReplies.insertPost = () => reasons.shift()!;
    await renderPostMode();
    await click('generate', postFlow());

    await click('postFill');
    expect(postFlow().textContent).toContain('postFillNotFound');
    await click('postFill');
    expect(postFlow().textContent).toContain('replyFillRejected');

    // The content script went away: the rejection is shown as a localized error.
    delete contentReplies.insertPost;
    await click('postFill');
    expect(postFlow().textContent).toContain('errorGeneric');
  });

  it('sends no title and counts characters against the X limit', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation((async () => [{ id: TAB_ID, url: xTarget.url }]) as never);
    useGenerate(postResult);
    contentReplies.getPostTarget = () => ({ target: xTarget });
    const fills: (PostDraft & { target: ThreadContext })[] = [];
    contentReplies.insertPost = (payload) => {
      fills.push(payload);
      return { ok: true };
    };
    await renderPostMode();
    await click('generate', postFlow());

    expect(container.querySelector('#post-title')).toBeNull();
    const count = () => container.querySelector('#post-count')!;
    expect(count().textContent).toBe(`replyCharCount(${'Generated body'.length},280)`);
    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#post-draft')!, 'a'.repeat(281)));
    expect(count().textContent).toBe('replyCharCount(281,280)');
    expect(count().className).toBe('error');
    expect(postFlow().textContent).toContain('postOverLimit(280)');

    await click('postFill');
    expect(fills).toEqual([{ body: 'a'.repeat(281), target: xTarget }]);
  });

  it('keeps Fill disabled when the post output cannot be parsed', async () => {
    useGenerate({ raw: 'not json', parsed: null });
    contentReplies.getPostTarget = () => ({ target: redditTarget });
    await renderPostMode();
    await click('generate', postFlow());
    expect(postFlow().querySelector('.raw')!.textContent).toBe('not json');
    expect(container.querySelector('#post-title')).toBeNull();
    expect(button('postFill').disabled).toBe(true);
  });
});
