import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { ThreadContext } from '@/src/adapters/types';
import { registerReplyTargetCleanup, selectReplyTarget } from '@/src/background/reply-target';
import { registerHandlers, sendToBackground, type BackgroundMessages } from '@/src/messaging/protocol';
import { replyTargetItem } from '@/src/storage/items';

const thread: ThreadContext = {
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

  it('clears a tab target when the tab closes or navigates', async () => {
    registerReplyTargetCleanup();
    await replyTargetItem(1).setValue(thread);
    await replyTargetItem(2).setValue(thread);
    await replyTargetItem(3).setValue(thread);

    await fakeBrowser.tabs.onRemoved.trigger(1, { isWindowClosing: false, windowId: 0 });
    await fakeBrowser.tabs.onUpdated.trigger(2, { url: 'https://www.reddit.com/r/other/' }, { id: 2 } as Browser.tabs.Tab);
    await fakeBrowser.tabs.onUpdated.trigger(3, { status: 'complete' }, { id: 3 } as Browser.tabs.Tab);
    await vi.waitFor(async () => {
      expect(await replyTargetItem(1).getValue()).toBeNull();
      expect(await replyTargetItem(2).getValue()).toBeNull();
    });
    expect(await replyTargetItem(3).getValue()).toEqual(thread);
  });
});
