// The operator's selected reply target on the page: the Draft reply buttons, which
// one is pressed, and the note that reports the selection. The background stores
// the target itself; this module only keeps the page in step with it.

import type { PlatformAdapter } from '@/src/adapters/types';
import { t } from '@/src/i18n';
import { sendToBackground } from '@/src/messaging/protocol';
import { errorMessage } from '@/src/ui/errors';
import type { Toolbar } from './toolbar';

export interface Selection {
  /** Add a Draft reply button for `target` to `toolbar`, unless it already has one on the page. */
  addButton(target: HTMLElement, toolbar: Toolbar): void;
  /** Forget buttons the page removed. */
  prune(): void;
  /** Drop the selection, and the stored target, when the page now shows another conversation. */
  followPage(): void;
  /** Forget the selection and stop showing it (the stored target is cleared separately). */
  reset(): void;
}

export function createSelection(
  adapter: PlatformAdapter,
  doc: Document,
  isValid: () => boolean,
  clearStoredTarget: () => void,
): Selection {
  const buttons = new Map<HTMLElement, HTMLButtonElement>();
  let active = false;
  /** Page key at the time the operator selected a target here; a different key clears the stored target. */
  let pageKey: string | null = null;
  /** Toolbar of the selected target, whose note reports the selection. */
  let noteToolbar: Toolbar | null = null;

  function reset(): void {
    active = false;
    pageKey = null;
    for (const button of buttons.values()) button.setAttribute('aria-pressed', 'false');
    noteToolbar?.setNote('');
    noteToolbar = null;
  }

  async function select(target: HTMLElement, toolbar: Toolbar): Promise<void> {
    if (!isValid()) return;
    active = true;
    pageKey = adapter.pageKey(doc);
    for (const [owner, button] of buttons) button.setAttribute('aria-pressed', String(owner === target));
    noteToolbar?.setNote('');
    noteToolbar = toolbar;
    toolbar.setNote('');
    // The selection may have been cleared or moved while the background stored it; report only on the current one.
    try {
      const { sidePanelOpened } = await sendToBackground('selectReplyTarget', { thread: adapter.extractThread(target) });
      if (noteToolbar === toolbar) toolbar.setNote(sidePanelOpened ? t('contentReplySelected') : t('contentOpenSidePanel'));
    } catch (error) {
      if (noteToolbar === toolbar) toolbar.setNote(errorMessage(error));
    }
  }

  return {
    addButton(target, toolbar) {
      if (buttons.get(target)?.isConnected) return;
      buttons.set(target, toolbar.addReplyButton(t('contentDraftReply'), () => void select(target, toolbar)));
    },
    prune() {
      for (const [target, button] of buttons) if (!target.isConnected || !button.isConnected) buttons.delete(target);
    },
    followPage() {
      if (!active || adapter.pageKey(doc) === pageKey) return;
      reset();
      clearStoredTarget();
    },
    reset,
  };
}
