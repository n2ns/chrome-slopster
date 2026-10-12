import { useEffect, useState } from 'react';
import type { ThreadContext } from '@/src/adapters/types';
import { replyTargetItem } from '@/src/storage/items';

export interface ActiveTab {
  tabId: number | undefined;
  /** Only known for sites the extension has host permissions for. */
  url: string | undefined;
}

/** The active tab of this page's window; follows tab switches and navigation. */
export function useActiveTab(): ActiveTab {
  const [tab, setTab] = useState<ActiveTab>({ tabId: undefined, url: undefined });

  useEffect(() => {
    let disposed = false;
    let latest = 0;
    const refresh = () => {
      const request = ++latest;
      const apply = (next: ActiveTab) => {
        if (disposed || request !== latest) return;
        setTab((current) => (current.tabId === next.tabId && current.url === next.url ? current : next));
      };
      browser.tabs.query({ active: true, currentWindow: true }).then(
        ([active]) => apply({ tabId: active?.id, url: active?.url }),
        () => apply({ tabId: undefined, url: undefined }),
      );
    };
    const onUpdated = (_tabId: number, changeInfo: Browser.tabs.OnUpdatedInfo) => {
      if (changeInfo.url !== undefined) refresh();
    };

    refresh();
    browser.tabs.onActivated.addListener(refresh);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      disposed = true;
      browser.tabs.onActivated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return tab;
}

/** The reply target a page's reply button stored for a tab, kept up to date. */
export function useReplyTarget(tabId: number | undefined): ThreadContext | null {
  const [target, setTarget] = useState<{ tabId: number; thread: ThreadContext | null }>();

  useEffect(() => {
    if (tabId === undefined) return;
    const item = replyTargetItem(tabId);
    let disposed = false;
    item.getValue().then(
      (thread) => {
        if (!disposed) setTarget({ tabId, thread });
      },
      () => undefined,
    );
    const unwatch = item.watch((thread) => setTarget({ tabId, thread }));
    return () => {
      disposed = true;
      unwatch();
    };
  }, [tabId]);

  // Ignore a value still held from the previously active tab.
  return target !== undefined && target.tabId === tabId ? target.thread : null;
}
