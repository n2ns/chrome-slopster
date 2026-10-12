import { registerHandlers, type BackgroundMessages } from '@/src/messaging/protocol';
import { generateDraft } from '@/src/prompt/generate';
import { translateText } from '@/src/translation/translate';

export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel instead of a popup.
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error('Failed to set side panel behavior.', error));

  registerHandlers<BackgroundMessages>({
    translate: ({ text, targetLanguage }) => translateText(text, targetLanguage),
    generate: (request) => generateDraft(request),
  });
});
