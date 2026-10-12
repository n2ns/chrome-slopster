// Side panel reply flow: target selection, generation payload, results, filling.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import SidepanelApp from '@/entrypoints/sidepanel/App';
import type { InsertResult, ThreadContext } from '@/src/adapters/types';
import { registerHandlers, type BackgroundMessages } from '@/src/messaging/protocol';
import type { GenerationRequest, GenerationResult } from '@/src/prompt/types';
import { replyTargetItem, settingsItem } from '@/src/storage/items';
import { getActivePersona } from '@/src/storage/personas';
import { DEFAULT_SETTINGS } from '@/src/storage/types';
import { installLocksPolyfill } from './helpers/browser';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAB_ID = 7;

const post: ThreadContext = {
  kind: 'post',
  platform: 'reddit',
  url: 'https://www.reddit.com/r/test/comments/abc/post/',
  community: 'r/test',
  title: 'Post title',
  body: 'Post body',
  parentChain: [],
  comments: [],
};

const comment: ThreadContext = { ...post, kind: 'comment', url: 'https://www.reddit.com/r/selfhosted/comments/abc/comment/c1/', body: 'First comment line\nsecond line', parentChain: ['Post body'] };

const parsedResult: GenerationResult = {
  raw: '{}',
  parsed: { shouldReply: true, reason: 'On topic', reply: 'Generated reply', replyNative: 'Review copy text', reviewNotes: 'Check facts' },
};

let root: Root;
let container: HTMLElement;
let contentReplies: { getThreadContext?: () => unknown; insertText?: (text: string, thread: ThreadContext) => InsertResult };
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

function setValue(element: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
  if (!found) throw new Error(`No button "${label}"`);
  return found;
}

async function click(label: string) {
  await act(async () => button(label).click());
  await settle();
}

function useGenerate(result: GenerationResult) {
  registerHandlers<BackgroundMessages>({
    generate: async (request) => {
      generateRequests.push(request);
      return result;
    },
  });
}

describe('side panel reply flow', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    installLocksPolyfill();
    // Return the key, with substitutions appended, so assertions do not depend on wording.
    vi.spyOn(fakeBrowser.i18n, 'getMessage').mockImplementation(((key: string, subs?: string | string[]) =>
      subs === undefined ? key : `${key}(${([] as string[]).concat(subs).join(',')})`) as never);
    vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue('en');
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation((async () => [{ id: TAB_ID, url: post.url }]) as never);

    contentReplies = {};
    sentToTab = [];
    generateRequests = [];
    vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockImplementation((async (tabId: number, message: { type: string; payload: unknown }) => {
      sentToTab.push({ tabId, type: message.type, payload: message.payload });
      if (message.type === 'getThreadContext' && contentReplies.getThreadContext) {
        return { ok: true, data: contentReplies.getThreadContext() };
      }
      if (message.type === 'insertText' && contentReplies.insertText) {
        const payload = message.payload as { text: string; thread: ThreadContext };
        return { ok: true, data: contentReplies.insertText(payload.text, payload.thread) };
      }
      throw new Error('Could not establish connection. Receiving end does not exist.');
    }) as never);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('generates from the stored reply target with the active persona and intent', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, operatorLanguage: 'zh-CN' });
    await replyTargetItem(TAB_ID).setValue(comment);
    useGenerate(parsedResult);
    await render();

    expect(container.querySelector('.target-summary')!.textContent).toBe('First comment line');
    expect(container.textContent).toContain('replyTargetComment');
    expect(container.querySelector('.target-meta')!.textContent).toBe('replyPlatformReddit · r/test');

    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#intent')!, 'Agree politely'));
    await click('generate');

    expect(sentToTab).toEqual([]);
    expect(generateRequests).toEqual([
      { mode: 'reply', thread: comment, persona: await getActivePersona(), intent: 'Agree politely', operatorLanguage: 'zh-CN' },
    ]);
    expect(container.querySelector<HTMLTextAreaElement>('#reply-draft')!.value).toBe('Generated reply');
    expect(container.querySelector('.verdict')!.textContent).toContain('replyVerdictYes');
    expect(container.querySelector('.verdict')!.classList.contains('warning')).toBe(false);
    expect(container.querySelector('.native')!.textContent).toBe('Review copy text');
    expect(container.querySelector('.notes')!.textContent).toBe('Check facts');
    expect(container.textContent).toContain('replyManualSendReminder');
    expect(container.querySelector('#reply-count')).toBeNull();
  });

  it('follows changes to the stored target and can clear it', async () => {
    await render();
    expect(container.querySelector('.target')).toBeNull();

    await act(async () => void (await replyTargetItem(TAB_ID).setValue(post)));
    await settle();
    expect(container.querySelector('.target-summary')!.textContent).toBe('Post title');

    await click('replyTargetClear');
    expect(container.querySelector('.target')).toBeNull();
    expect(await replyTargetItem(TAB_ID).getValue()).toBeNull();
  });

  it('falls back to the page thread from the content script', async () => {
    contentReplies.getThreadContext = () => ({ thread: post });
    useGenerate(parsedResult);
    await render();
    await click('generate');

    expect(sentToTab).toEqual([{ tabId: TAB_ID, type: 'getThreadContext', payload: {} }]);
    expect(generateRequests[0]!.thread).toEqual(post);
    expect(container.querySelector('.target-summary')!.textContent).toBe('Post title');
  });

  it('shows a hint when the page has no thread or no content script', async () => {
    useGenerate(parsedResult);
    await render();
    await click('generate');
    expect(container.textContent).toContain('replyNoThread');

    contentReplies.getThreadContext = () => ({ thread: null });
    await click('generate');
    expect(container.textContent).toContain('replyNoThread');
    expect(generateRequests).toEqual([]);
  });

  it('shows raw output and keeps Fill disabled when the result cannot be parsed', async () => {
    await replyTargetItem(TAB_ID).setValue(post);
    useGenerate({ raw: 'not json at all', parsed: null });
    await render();
    await click('generate');

    expect(container.textContent).toContain('replyUnparsed');
    expect(container.querySelector('.raw')!.textContent).toBe('not json at all');
    expect(container.querySelector('#reply-draft')).toBeNull();
    expect(button('replyFill').disabled).toBe(true);
  });

  it('warns prominently when the model advises not to reply', async () => {
    await replyTargetItem(TAB_ID).setValue(post);
    useGenerate({ raw: '{}', parsed: { ...parsedResult.parsed!, shouldReply: false, reason: 'Off topic' } });
    await render();
    await click('generate');

    const verdict = container.querySelector('.verdict')!;
    expect(verdict.classList.contains('warning')).toBe(true);
    expect(verdict.textContent).toContain('replyVerdictNo');
    expect(verdict.textContent).toContain('Off topic');
  });

  it('fills into the thread the draft was generated for, even after another target is selected', async () => {
    await replyTargetItem(TAB_ID).setValue(comment);
    useGenerate(parsedResult);
    const fills: ThreadContext[] = [];
    contentReplies.insertText = (_text, thread) => {
      fills.push(thread);
      return { ok: true };
    };
    await render();
    await click('generate');
    await act(async () => void (await replyTargetItem(TAB_ID).setValue(post)));
    await settle();
    await click('replyFill');
    expect(fills.map((thread) => thread.url)).toEqual([comment.url]);
  });

  it('labels a comment target as a comment even when the post has no body', async () => {
    await replyTargetItem(TAB_ID).setValue({ ...comment, parentChain: [] });
    await render();
    expect(container.textContent).toContain('replyTargetComment');
  });

  it('fills the edited reply and reports a failed insert', async () => {
    await replyTargetItem(TAB_ID).setValue(post);
    useGenerate(parsedResult);
    const inserted: string[] = [];
    contentReplies.insertText = (text) => {
      inserted.push(text);
      return inserted.length === 1 ? { ok: true } : { ok: false, reason: 'not-found' };
    };
    await render();
    await click('generate');

    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#reply-draft')!, 'Edited reply'));
    await click('replyFill');
    expect(inserted).toEqual(['Edited reply']);
    expect(container.querySelector('.status')!.textContent).toBe('replyFilled');

    await click('replyFill');
    expect(container.querySelector('.error')!.textContent).toBe('replyFillNotFound');
  });

  it('shows a localized error when the fill message fails', async () => {
    await replyTargetItem(TAB_ID).setValue(post);
    useGenerate(parsedResult);
    await render();
    await click('generate');
    await click('replyFill');
    expect(container.querySelector('.error')!.textContent).toBe('errorGeneric');
  });

  it('counts characters against X limit', async () => {
    await replyTargetItem(TAB_ID).setValue({ ...post, platform: 'x', community: undefined, title: undefined });
    useGenerate(parsedResult);
    await render();
    await click('generate');

    const count = () => container.querySelector('#reply-count')!;
    expect(count().textContent).toBe(`replyCharCount(${'Generated reply'.length},280)`);
    expect(container.textContent).not.toContain('replyOverLimit');

    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#reply-draft')!, 'a'.repeat(281)));
    expect(count().textContent).toBe('replyCharCount(281,280)');
    expect(count().className).toBe('error');
    expect(container.textContent).toContain('replyOverLimit(280)');
  });
});
