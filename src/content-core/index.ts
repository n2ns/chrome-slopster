// Platform-agnostic content script: injects translate / draft-reply controls next
// to the adapter's content units, answers the side panel's messages, and applies
// the platform's ad-block toggle. Never submits anything on the page.

import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { PlatformAdapter } from '@/src/adapters/types';
import { t } from '@/src/i18n';
import { registerHandlers, sendToBackground, type ContentMessages } from '@/src/messaging/protocol';
import { adBlockItem, getSettings, settingsItem } from '@/src/storage/items';
import { getAdBlock } from '@/src/storage/settings';
import { normalizeTranslationColor, normalizeTranslationTextColor, type Settings } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { createSelection } from './selection';
import { createToolbar, type Toolbar } from './toolbar';

const SCAN_DELAY_MS = 250;
const AD_ATTRIBUTE = 'data-sra-hidden-ad';
/** Marks a unit whose original text is hidden because its translation is shown and the operator chose to hide originals. */
const ORIGINAL_ATTRIBUTE = 'data-sra-original-hidden';

/** Innermost reply target that contains `unit`: walk up from the unit, O(depth). */
function ownerTarget(unit: HTMLElement, targets: Set<HTMLElement>): HTMLElement | undefined {
  for (let node = unit.parentElement; node; node = node.parentElement) {
    if (targets.has(node)) return node;
  }
  return undefined;
}

/** One translatable unit on the page and its toolbar. A replaced toolbar gets a fresh record. */
interface UnitState {
  toolbar: Toolbar;
  /** A translation was requested (and has not failed), so automatic translation skips the unit. */
  translated: boolean;
  /** The translation is shown, so the hide-original setting applies to the unit. */
  shown: boolean;
  /** Waiting for its first intersection, which automatic translation acts on. */
  observing: boolean;
}

export function runContentScript(adapter: PlatformAdapter, ctx: ContentScriptContext): void {
  const doc = document;
  /** Each unit's record; kept while the page detaches a unit, so the unit keeps its toolbar if it comes back. */
  const units = new WeakMap<HTMLElement, UnitState>();
  /** Units on the page, for settings that apply to all of them. */
  const live = new Set<HTMLElement>();
  const selection = createSelection(adapter, doc, () => ctx.isValid, clearStoredTarget);
  let autoTranslate = false;
  let blockAds = false;
  let accent = normalizeTranslationColor(undefined);
  let textColor = normalizeTranslationTextColor(undefined);
  let hideOriginal = false;
  let scanTimer: number | undefined;

  const adStyle = doc.createElement('style');
  adStyle.textContent = `[${AD_ATTRIBUTE}], [${ORIGINAL_ATTRIBUTE}] { display: none !important; }`;
  (doc.head ?? doc.documentElement).append(adStyle);

  /** Hide the unit's original text only while its translation is shown and the setting is on. */
  function applyOriginal(unit: HTMLElement, state: UnitState | undefined): void {
    unit.toggleAttribute(ORIGINAL_ATTRIBUTE, hideOriginal && state?.shown === true);
  }

  async function translateUnit(unit: HTMLElement, state: UnitState): Promise<void> {
    if (!ctx.isValid) return;
    const { toolbar } = state;
    if (toolbar.isOutputVisible() && state.translated) {
      state.shown = false;
      applyOriginal(unit, state);
      toolbar.setOutput(null);
      toolbar.translateButton.textContent = t('contentShowTranslation');
      return;
    }
    const text = adapter.extractText(unit);
    if (!text) return;
    state.translated = true;
    toolbar.translateButton.disabled = true;
    toolbar.translateButton.textContent = t('contentTranslating');
    try {
      const result = await sendToBackground('translate', { text });
      toolbar.setOutput(result.truncated ? `${result.text}\n\n${t('translationTruncated')}` : result.text);
      toolbar.translateButton.textContent = t('contentHideTranslation');
      // Hide the original only if this toolbar still shows the translation (the page may have replaced it meanwhile).
      if (units.get(unit) === state && toolbar.host.isConnected) {
        state.shown = true;
        applyOriginal(unit, state);
      }
    } catch (error) {
      state.translated = false;
      toolbar.setOutput(errorMessage(error), true);
      toolbar.translateButton.textContent = t('contentTranslate');
    } finally {
      toolbar.translateButton.disabled = false;
    }
  }

  const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !autoTranslate) continue;
      const unit = entry.target as HTMLElement;
      visibility.unobserve(unit);
      const state = units.get(unit);
      if (!state) continue;
      state.observing = false;
      if (!state.translated) void translateUnit(unit, state);
    }
  });

  function applyAutoTranslate(enabled: boolean): void {
    const wasEnabled = autoTranslate;
    autoTranslate = enabled;
    if (enabled && !wasEnabled) {
      // A visible unit has already delivered its initial intersection while disabled.
      for (const unit of live) {
        const state = units.get(unit);
        if (!state?.observing || state.translated) continue;
        visibility.unobserve(unit);
        visibility.observe(unit);
      }
    }
  }

  function applyAds(): void {
    if (blockAds) {
      for (const ad of adapter.findAds(doc)) ad.setAttribute(AD_ATTRIBUTE, '');
    } else {
      for (const ad of doc.querySelectorAll(`[${AD_ATTRIBUTE}]`)) ad.removeAttribute(AD_ATTRIBUTE);
    }
  }

  function addToolbar(unit: HTMLElement): UnitState {
    const toolbar = createToolbar(unit, t('contentTranslate'));
    toolbar.setAccent(accent);
    toolbar.setTextColor(textColor);
    const state: UnitState = { toolbar, translated: false, shown: false, observing: true };
    toolbar.translateButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void translateUnit(unit, state);
    });
    units.set(unit, state);
    // A new toolbar starts without a translation, so the original must be visible again.
    applyOriginal(unit, state);
    visibility.observe(unit);
    return state;
  }

  function scan(): void {
    scanTimer = undefined;
    if (!ctx.isValid) return;
    // The page may now show another conversation (SPA navigation).
    selection.followPage();
    // Forget nodes the page removed (SPA navigation, collapsed threads, re-rendered toolbars).
    selection.prune();
    for (const unit of live) {
      const state = units.get(unit)!;
      if (!unit.isConnected) {
        // Detached: no longer waits for automatic translation, but keeps its record and toolbar.
        visibility.unobserve(unit);
        state.observing = false;
        live.delete(unit);
      } else if (!state.toolbar.host.isConnected) {
        // The page removed the toolbar but kept the unit: show the original until a new toolbar replaces it.
        visibility.unobserve(unit);
        units.delete(unit);
        live.delete(unit);
        applyOriginal(unit, undefined);
      }
    }
    const targets = new Set(adapter.findReplyTargets(doc));
    // The last unit owned by a target gets its reply button (e.g. the post body rather than its title).
    const lastUnitOf = new Map<HTMLElement, UnitState>();
    for (const unit of adapter.findTranslatableUnits(doc)) {
      const existing = units.get(unit);
      const state = existing?.toolbar.host.isConnected ? existing : addToolbar(unit);
      live.add(unit);
      const owner = ownerTarget(unit, targets);
      if (owner) lastUnitOf.set(owner, state);
    }
    for (const [target, state] of lastUnitOf) selection.addButton(target, state.toolbar);
    applyAds();
  }

  /** Apply the translation display settings (colors, hide original) to everything on the page. */
  function applyDisplay(settings: Partial<Settings> | null | undefined): void {
    accent = normalizeTranslationColor(settings?.translationColor);
    textColor = normalizeTranslationTextColor(settings?.translationTextColor);
    hideOriginal = settings?.hideOriginal === true;
    for (const unit of live) {
      const state = units.get(unit)!;
      state.toolbar.setAccent(accent);
      state.toolbar.setTextColor(textColor);
      applyOriginal(unit, state);
    }
  }

  function clearStoredTarget(): void {
    sendToBackground('clearReplyTarget', {}).catch((error: unknown) => console.warn('Failed to clear the reply target.', error));
  }

  function scheduleScan(): void {
    if (scanTimer === undefined && ctx.isValid) scanTimer = ctx.setTimeout(scan, SCAN_DELAY_MS);
  }

  const observer = new MutationObserver((mutations) => {
    // Ignore mutations that only added our own toolbars; removals still matter.
    const ownOnly = (mutation: MutationRecord) =>
      mutation.removedNodes.length === 0 &&
      mutation.addedNodes.length > 0 &&
      [...mutation.addedNodes].every((node) => node instanceof Element && node.hasAttribute('data-sra-toolbar'));
    if (mutations.every(ownOnly)) return;
    scheduleScan();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });

  registerHandlers<ContentMessages>({
    getThreadContext: async () => {
      const [first] = adapter.findReplyTargets(doc);
      const thread = first ? adapter.extractThread(first) : null;
      return { thread: thread?.kind === 'post' ? thread : null };
    },
    getPostTarget: async () => ({ target: adapter.postTarget(doc) }),
    insertPost: async ({ title, body, target }) => {
      // The form must still be open on the page the draft was generated for.
      const composer = adapter.findPostComposer(doc);
      if (!composer || adapter.postTarget(doc)?.url !== target.url) return { ok: false, reason: 'not-found' };
      return adapter.insertPost(composer, { title, body });
    },
    insertText: async ({ text, thread }) => {
      // Resolve the target from the thread the draft was written for, so it can never land in another post's or comment's box.
      const target = adapter.findReplyTargets(doc).find((candidate) => adapter.extractThread(candidate).url === thread.url);
      const composer = target ? adapter.findComposer(target) : null;
      return composer ? adapter.insertText(composer, text) : { ok: false, reason: 'not-found' };
    },
    replyTargetCleared: async () => {
      selection.reset();
      return {};
    },
  });

  void getSettings().then((settings) => {
    applyAutoTranslate(settings.autoTranslate);
    applyDisplay(settings);
  });
  void getAdBlock().then((adBlock) => {
    blockAds = adBlock[adapter.id];
    applyAds();
  });
  const unwatchSettings = settingsItem.watch((settings) => {
    applyAutoTranslate(Boolean(settings?.autoTranslate));
    applyDisplay(settings);
  });
  const unwatchAds = adBlockItem.watch((adBlock) => {
    blockAds = Boolean(adBlock?.[adapter.id]);
    applyAds();
  });

  const detachAdapter = adapter.attach?.(doc);

  // A new document in this tab, or one restored from the back/forward cache (which does not
  // rerun content scripts): a target stored for another page no longer applies.
  clearStoredTarget();
  // SPA navigation may not touch the DOM right away; check the page key on every URL change.
  ctx.addEventListener(window, 'wxt:locationchange', scheduleScan);
  ctx.addEventListener(window, 'pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) {
      selection.reset();
      clearStoredTarget();
    }
  });

  ctx.onInvalidated(() => {
    detachAdapter?.();
    observer.disconnect();
    visibility.disconnect();
    unwatchSettings();
    unwatchAds();
  });

  scan();
}
