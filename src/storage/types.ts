// Shared data types and defaults for everything persisted in chrome.storage.

export type AiEngine = 'openai' | 'deepseek' | 'gemini' | 'claude';
/** Free Google Translate, or the selected AI engine (`aiEngine`), which is global. */
export type TranslationEngine = 'google-free' | 'ai';
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
  /**
   * Background color of translations shown on pages (left border and tinted background), as #rrggbb:
   * one of TRANSLATION_COLOR_PRESETS or a custom color. The key predates the text color and is kept so saved values stay.
   */
  translationColor: string;
  /** Text color of translations shown on pages, as #rrggbb; '' keeps the page's own text color. */
  translationTextColor: string;
  /** Hide a post's or comment's original text while its translation is shown on the page. */
  hideOriginal: boolean;
}

/** Preset translation colors (background and text), with the i18n key of each name. The first one is the default background. */
export const TRANSLATION_COLOR_PRESETS = [
  { color: '#5b8def', label: 'colorBlue' },
  { color: '#2e9d5b', label: 'colorGreen' },
  { color: '#f08c00', label: 'colorOrange' },
  { color: '#e5484d', label: 'colorRed' },
  { color: '#8a94a6', label: 'colorGray' },
] as const;

/** A stored translation color as lowercase #rrggbb; anything else (missing, malformed) becomes the default preset. */
export function normalizeTranslationColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : TRANSLATION_COLOR_PRESETS[0].color;
}

/** A stored translation text color as lowercase #rrggbb; anything else (missing, malformed, '') becomes '' (the page's color). */
export function normalizeTranslationTextColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '';
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
  translationColor: TRANSLATION_COLOR_PRESETS[0].color,
  translationTextColor: '',
  hideOriginal: false,
};

export const DEFAULT_AD_BLOCK: AdBlockSettings = { reddit: false, x: false, facebook: false };

export const EMPTY_API_KEYS: ApiKeys = { openai: '', deepseek: '', gemini: '', claude: '' };
