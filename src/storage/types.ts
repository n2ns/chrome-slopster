// Shared data types and defaults for everything persisted in chrome.storage.

export type AiEngine = 'openai' | 'deepseek' | 'gemini' | 'claude';
export type TranslationEngine = 'google-free' | AiEngine;
export type PlatformId = 'reddit' | 'x' | 'facebook';

export const AI_ENGINES: readonly AiEngine[] = ['openai', 'deepseek', 'gemini', 'claude'];
export const PLATFORMS: readonly PlatformId[] = ['reddit', 'x', 'facebook'];

export function isAiEngine(value: unknown): value is AiEngine {
  return typeof value === 'string' && (AI_ENGINES as readonly string[]).includes(value);
}

/** A voice the operator replies in. Contains no product or promotion data. */
export interface Persona {
  id: string;
  name: string;
  /** Who the operator is and their background; guides wording, must not be embellished. */
  identity: string;
  /** Free-text tone description. */
  tone: string;
  /** BCP 47 language tag for replies, or 'auto' to follow the post's language. */
  replyLanguage: 'auto' | string;
  bannedWords: string[];
  customRules: string[];
  /** Whether the anti-AI-voice tone rules are added to the prompt. */
  antiAiVoice: boolean;
}

/** Non-secret settings, synced across the operator's devices. */
export interface Settings {
  translationEngine: TranslationEngine;
  aiEngine: AiEngine;
  /** Saved model per engine; resolve with resolveModel() before use. */
  models: Record<AiEngine, string>;
  /** Language the operator reads in: target of page translation and of the review copy. 'auto' = browser UI language. */
  operatorLanguage: 'auto' | string;
  autoTranslate: boolean;
  /** Fall back to the selected AI engine when Google free translation fails or is cooling down. */
  aiFallback: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

export type AdBlockSettings = Record<PlatformId, boolean>;

/** Secrets. Stored in chrome.storage.local only, never synced. */
export type ApiKeys = Record<AiEngine, string>;

export const DEFAULT_SETTINGS: Settings = {
  translationEngine: 'google-free',
  aiEngine: 'gemini',
  models: { openai: '', deepseek: '', gemini: '', claude: '' },
  operatorLanguage: 'auto',
  autoTranslate: false,
  aiFallback: false,
  fontSize: 'medium',
};

export const DEFAULT_AD_BLOCK: AdBlockSettings = { reddit: false, x: false, facebook: false };

export const EMPTY_API_KEYS: ApiKeys = { openai: '', deepseek: '', gemini: '', claude: '' };
