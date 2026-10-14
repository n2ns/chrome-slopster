import { t, type MessageKey } from '@/src/i18n';
import type { AiEngine } from '@/src/storage/types';

const ENGINE_KEYS: Record<'google-free' | AiEngine, MessageKey> = {
  'google-free': 'engineGoogleFree',
  openai: 'engineOpenai',
  deepseek: 'engineDeepseek',
  gemini: 'engineGemini',
  claude: 'engineClaude',
};

export function engineLabel(engine: 'google-free' | AiEngine): string {
  return t(ENGINE_KEYS[engine]);
}

/** Languages offered for the operator language and persona reply language (BCP 47). */
export const LANGUAGE_CODES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'it', 'vi', 'id', 'ar', 'hi'];

/** A language's name in the browser UI language, e.g. "Japanese" or "日语". */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames([browser.i18n.getUILanguage()], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
