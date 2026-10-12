import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { ThreadContext } from '@/src/adapters/types';
import { clearReplyTarget, registerReplyTargetCleanup, selectReplyTarget } from '@/src/background/reply-target';
import { registerHandlers, sendToBackground, type BackgroundMessages } from '@/src/messaging/protocol';
import { replyTargetItem } from '@/src/storage/items';

const thread: ThreadContext = {
  kind: 'post',
  platform: 'reddit',
  url: 'https://www.reddit.com/r/test/comments/abc/post/',
  community: 'r/test',
  title: 'A post',
  body: 'Body',
  parentChain: [],
  comments: [],
};

function sender(tabId?: number): Browser.runtime.MessageSender {
  return tabId === undefined ? {} : { tab: { id: tabId } as Browser.tabs.Tab };
}

describe('selectReplyTarget', () => {
  beforeEach(() => fakeBrowser.reset());
  afterEach(() => vi.restoreAllMocks());

  it('stores the target per tab and reports the opened side panel', async () => {
    const open = vi.spyOn(fakeBrowser.sidePanel, 'open').mockResolvedValue(undefined as never);
    await expect(selectReplyTarget({ thread }, sender(5))).resolves.toEqual({ sidePanelOpened: true });
    expect(open).toHaveBeenCalledWith({ tabId: 5 });
    expect(await replyTargetItem(5).getValue()).toEqual(thread);
    expect(await replyTargetItem(6).getValue()).toBeNull();
  });

  it('still stores the target when the side panel cannot open', async () => {
    vi.spyOn(fakeBrowser.sidePanel, 'open').mockRejectedValue(new Error('requires a user gesture'));
    await expect(selectReplyTarget({ thread }, sender(5))).resolves.toEqual({ sidePanelOpened: false });
    expect(await replyTargetItem(5).getValue()).toEqual(thread);
  });

  it('rejects a message that did not come from a tab', async () => {
    registerHandlers<BackgroundMessages>({ selectReplyTarget });
    await expect(sendToBackground('selectReplyTarget', { thread })).rejects.toMatchObject({ code: 'invalid-request' });
  });

  it('clears a tab target when the tab closes, but not when only the URL changes', async () => {
    registerReplyTargetCleanup();
    await replyTargetItem(1).setValue(thread);
    await replyTargetItem(2).setValue(thread);

    await fakeBrowser.tabs.onRemoved.trigger(1, { isWindowClosing: false, windowId: 0 });
    // X opens its reply dialog at /compose/post while the tweet stays on the page.
    await fakeBrowser.tabs.onUpdated.trigger(2, { url: 'https://x.com/compose/post' }, { id: 2 } as Browser.tabs.Tab);
    await vi.waitFor(async () => expect(await replyTargetItem(1).getValue()).toBeNull());
    expect(await replyTargetItem(2).getValue()).toEqual(thread);
  });

  it('clears the sender tab target on request from its content script', async () => {
    await replyTargetItem(7).setValue(thread);
    await replyTargetItem(8).setValue(thread);
    await clearReplyTarget({}, sender(7));
    expect(await replyTargetItem(7).getValue()).toBeNull();
    expect(await replyTargetItem(8).getValue()).toEqual(thread);
  });
});
