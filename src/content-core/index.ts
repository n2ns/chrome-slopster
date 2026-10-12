// Platform-agnostic content script: injects translate / draft-reply controls next
// to the adapter's content units, answers the side panel's messages, and applies
// the platform's ad-block toggle. Never submits anything on the page.

import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { PlatformAdapter } from '@/src/adapters/types';
import { t } from '@/src/i18n';
import { registerHandlers, sendToBackground, type ContentMessages } from '@/src/messaging/protocol';
import { adBlockItem, getSettings, settingsItem } from '@/src/storage/items';
import { getAdBlock } from '@/src/storage/settings';
import { errorMessage } from '@/src/ui/errors';
import { createToolbar, type Toolbar } from './toolbar';

const SCAN_DELAY_MS = 250;
const AD_ATTRIBUTE = 'data-sra-hidden-ad';

/** Innermost reply target that contains `unit`. */
function ownerTarget(unit: HTMLElement, targets: HTMLElement[]): HTMLElement | undefined {
  const containing = targets.filter((target) => target.contains(unit));
  return containing.find((candidate) => containing.every((other) => other === candidate || other.contains(candidate)));
}

export function runContentScript(adapter: PlatformAdapter, ctx: ContentScriptContext): void {
  const doc = document;
  const toolbars = new WeakMap<HTMLElement, Toolbar>();
  const translated = new WeakSet<HTMLElement>();
  const replyButtons = new Map<HTMLElement, HTMLButtonElement>();
  let lastTarget: HTMLElement | null = null;
  let autoTranslate = false;
  let blockAds = false;
  let scanTimer: number | undefined;

  const adStyle = doc.createElement('style');
  adStyle.textContent = `[${AD_ATTRIBUTE}] { display: none !important; }`;
  (doc.head ?? doc.documentElement).append(adStyle);

  async function translateUnit(unit: HTMLElement, toolbar: Toolbar): Promise<void> {
    if (!ctx.isValid) return;
    if (toolbar.isOutputVisible() && translated.has(unit)) {
      toolbar.setOutput(null);
      toolbar.translateButton.textContent = t('contentShowTranslation');
      return;
    }
    const text = adapter.extractText(unit);
    if (!text) return;
    translated.add(unit);
    toolbar.translateButton.disabled = true;
    toolbar.translateButton.textContent = t('contentTranslating');
    try {
      const result = await sendToBackground('translate', { text });
      toolbar.setOutput(result.truncated ? `${result.text}\n\n${t('translationTruncated')}` : result.text);
      toolbar.translateButton.textContent = t('contentHideTranslation');
    } catch (error) {
      translated.delete(unit);
      toolbar.setOutput(errorMessage(error), true);
      toolbar.translateButton.textContent = t('contentTranslate');
    } finally {
      toolbar.translateButton.disabled = false;
    }
  }

  async function selectTarget(target: HTMLElement, toolbar: Toolbar): Promise<void> {
    if (!ctx.isValid) return;
    lastTarget = target;
    for (const [owner, button] of replyButtons) button.setAttribute('aria-pressed', String(owner === target));
    toolbar.setNote('');
    try {
      const { sidePanelOpened } = await sendToBackground('selectReplyTarget', { thread: adapter.extractThread(target) });
      toolbar.setNote(sidePanelOpened ? t('contentReplySelected') : t('contentOpenSidePanel'));
    } catch (error) {
      toolbar.setNote(errorMessage(error));
    }
  }

  const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !autoTranslate) continue;
      const unit = entry.target as HTMLElement;
      visibility.unobserve(unit);
      const toolbar = toolbars.get(unit);
      if (toolbar && !translated.has(unit)) void translateUnit(unit, toolbar);
    }
  });

  function applyAds(): void {
    if (blockAds) {
      for (const ad of adapter.findAds(doc)) ad.setAttribute(AD_ATTRIBUTE, '');
    } else {
      for (const ad of doc.querySelectorAll(`[${AD_ATTRIBUTE}]`)) ad.removeAttribute(AD_ATTRIBUTE);
    }
  }

  function scan(): void {
    scanTimer = undefined;
    if (!ctx.isValid) return;
    const targets = adapter.findReplyTargets(doc);
    const placed = new Set<HTMLElement>();
    // The last unit owned by a target gets its reply button (e.g. the post body rather than its title).
    const units = adapter.findTranslatableUnits(doc);
    const lastUnitOf = new Map<HTMLElement, HTMLElement>();
    for (const unit of units) {
      const owner = ownerTarget(unit, targets);
      if (owner) lastUnitOf.set(owner, unit);
    }
    for (const unit of units) {
      const existing = toolbars.get(unit);
      if (!existing || !existing.host.isConnected) {
        const created = createToolbar(unit, t('contentTranslate'));
        created.translateButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          void translateUnit(unit, created);
        });
        toolbars.set(unit, created);
        visibility.observe(unit);
      }
      placed.add(unit);
    }
    for (const [target, unit] of lastUnitOf) {
      if (replyButtons.has(target) && replyButtons.get(target)!.isConnected) continue;
      const toolbar = toolbars.get(unit);
      if (!toolbar || !placed.has(unit)) continue;
      const button = toolbar.addReplyButton(t('contentDraftReply'), () => void selectTarget(target, toolbar));
      replyButtons.set(target, button);
    }
    applyAds();
  }

  function scheduleScan(): void {
    if (scanTimer === undefined && ctx.isValid) scanTimer = ctx.setTimeout(scan, SCAN_DELAY_MS);
  }

  const observer = new MutationObserver((mutations) => {
    // Ignore mutations caused only by our own toolbars.
    if (mutations.every((mutation) => [...mutation.addedNodes].every((node) => node instanceof Element && node.hasAttribute('data-sra-toolbar')))) return;
    scheduleScan();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });

  registerHandlers<ContentMessages>({
    getThreadContext: async () => {
      const [first] = adapter.findReplyTargets(doc);
      return { thread: first ? adapter.extractThread(first) : null };
    },
    insertText: async ({ text }) => {
      const target = lastTarget?.isConnected ? lastTarget : undefined;
      const composer = adapter.findComposer(target);
      return composer ? adapter.insertText(composer, text) : { ok: false, reason: 'not-found' };
    },
  });

  void getSettings().then((settings) => {
    autoTranslate = settings.autoTranslate;
  });
  void getAdBlock().then((adBlock) => {
    blockAds = adBlock[adapter.id];
    applyAds();
  });
  const unwatchSettings = settingsItem.watch((settings) => {
    autoTranslate = Boolean(settings?.autoTranslate);
  });
  const unwatchAds = adBlockItem.watch((adBlock) => {
    blockAds = Boolean(adBlock?.[adapter.id]);
    applyAds();
  });

  ctx.onInvalidated(() => {
    observer.disconnect();
    visibility.disconnect();
    unwatchSettings();
    unwatchAds();
  });

  scan();
}
