// Per-tab reply targets: written when a page's reply button is clicked, read by
// the side panel, and cleared when the page drops the target (reported by the
// content script) or the tab closes.

import type { ThreadContext } from '@/src/adapters/types';
import type { BackgroundMessages } from '@/src/messaging/protocol';
import { AppError } from '@/src/providers/types';
import { replyTargetItem } from '@/src/storage/items';

type SelectResponse = BackgroundMessages['selectReplyTarget']['response'];

/**
 * Remember the target for the sender's tab and try to open the side panel.
 * sidePanel.open() needs a user gesture, so it is called before any await;
 * it fails (sidePanelOpened: false) when the gesture did not survive the
 * message hop, and the operator opens the panel from the toolbar instead.
 */
export async function selectReplyTarget(
  { thread }: { thread: ThreadContext },
  sender: Browser.runtime.MessageSender,
): Promise<SelectResponse> {
  const tabId = sender.tab?.id;
  if (tabId === undefined) throw new AppError('invalid-request', 'selectReplyTarget must come from a tab.');

  let opening: Promise<boolean>;
  try {
    opening = browser.sidePanel.open({ tabId }).then(
      () => true,
      () => false,
    );
  } catch {
    opening = Promise.resolve(false);
  }
  await replyTargetItem(tabId).setValue(thread);
  return { sidePanelOpened: await opening };
}

/** Forget the sender tab's reply target. */
export async function clearReplyTarget(_request: Record<string, never>, sender: Browser.runtime.MessageSender): Promise<Record<string, never>> {
  const tabId = sender.tab?.id;
  if (tabId === undefined) throw new AppError('invalid-request', 'clearReplyTarget must come from a tab.');
  await replyTargetItem(tabId).removeValue();
  return {};
}

/** Drop a tab's reply target when the tab closes. */
export function registerReplyTargetCleanup(): void {
  browser.tabs.onRemoved.addListener((tabId) => {
    void replyTargetItem(tabId).removeValue();
  });
}
