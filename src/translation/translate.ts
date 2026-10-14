// Translation pipeline: engine choice, Google free cooldown, AI fallback, and
// length caps. Every request goes through the concurrency-capped queue.

import { resolveModel } from '@/src/models/registry';
import { AI_PROVIDERS, translateGoogleFree } from '@/src/providers';
import { AppError } from '@/src/providers/types';
import { getApiKeys, getSettings, googleFreeCooldownAtItem } from '@/src/storage/items';
import type { AiEngine, ApiKeys, Settings } from '@/src/storage/types';
import { AI_TRANSLATION_MAX_CHARS, GOOGLE_FREE_MAX_CHARS, limitProviderText } from './limits';
import { enqueueTranslation } from './queue';

export const GOOGLE_FREE_COOLDOWN_MS = 5 * 60 * 1000;

export interface TranslationResult {
  text: string;
  truncated: boolean;
}

/** 'auto' follows the browser UI language. */
export function resolveOperatorLanguage(operatorLanguage: string): string {
  return operatorLanguage === 'auto' || !operatorLanguage ? browser.i18n.getUILanguage() : operatorLanguage;
}

export async function isGoogleFreeCoolingDown(now = Date.now()): Promise<boolean> {
  const startedAt = await googleFreeCooldownAtItem.getValue();
  return startedAt > 0 && now - startedAt < GOOGLE_FREE_COOLDOWN_MS;
}

async function translateWithAi(engine: AiEngine, text: string, target: string, settings: Settings, keys: ApiKeys): Promise<TranslationResult> {
  const limited = limitProviderText(text, AI_TRANSLATION_MAX_CHARS);
  const model = resolveModel(engine, settings.models[engine]);
  const translated = await AI_PROVIDERS[engine].translate(limited.text, target, { apiKey: keys[engine], model });
  return { text: translated, truncated: limited.truncated };
}

/** Fall back to AI only when enabled and the fallback engine has a key; otherwise the Google failure stands. */
function canFallBack(settings: Settings, keys: ApiKeys): boolean {
  return settings.aiFallback && Boolean(keys[settings.aiEngine]);
}

async function translateWithGoogleFree(text: string, target: string, settings: Settings, keys: ApiKeys): Promise<TranslationResult> {
  if (await isGoogleFreeCoolingDown()) {
    if (canFallBack(settings, keys)) return translateWithAi(settings.aiEngine, text, target, settings, keys);
    throw new AppError('rate-limited', 'Google free translation is cooling down after a rate limit.');
  }

  const limited = limitProviderText(text, GOOGLE_FREE_MAX_CHARS);
  try {
    return { text: await translateGoogleFree(limited.text, target), truncated: limited.truncated };
  } catch (error) {
    if (error instanceof AppError && error.code === 'rate-limited') {
      await googleFreeCooldownAtItem.setValue(Date.now());
    }
    if (canFallBack(settings, keys)) return translateWithAi(settings.aiEngine, text, target, settings, keys);
    throw error;
  }
}

/** Translate `text` into `targetLanguage`, or into the resolved operator language when omitted. */
export async function translateText(text: string, targetLanguage?: string): Promise<TranslationResult> {
  if (!text.trim()) throw new AppError('invalid-request', 'Nothing to translate.');
  const [settings, keys] = await Promise.all([getSettings(), getApiKeys()]);
  const target = targetLanguage || resolveOperatorLanguage(settings.operatorLanguage);

  return enqueueTranslation(() =>
    settings.translationEngine === 'ai'
      ? translateWithAi(settings.aiEngine, text, target, settings, keys)
      : translateWithGoogleFree(text, target, settings, keys),
  );
}
