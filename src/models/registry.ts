// Single source of model IDs for every AI engine.
//
// Every `value` must be an ID the vendor's API actually accepts; a wrong one only
// fails at request time with an HTTP 4xx. Verify against the vendor docs, never
// from memory:
//   - OpenAI    https://developers.openai.com/api/docs/models
//   - DeepSeek  https://api-docs.deepseek.com/quick_start/pricing/
//   - Gemini    https://ai.google.dev/gemini-api/docs/models
//   - Claude    https://docs.claude.com/en/docs/about-claude/models/overview
//
// Last verified against the docs above: 2026-10-12.
//   - OpenAI: gpt-6-astra is the flagship; gpt-6-luna is the cheapest and the
//     documented replacement for gpt-5.4-nano (deprecated, shutdown 2027-04-01).
//   - DeepSeek: deepseek-v4-pro and deepseek-flash (DeepSeek-V4.1-Flash).
//   - Gemini: gemini-3.8-flash is the newest stable model (no stable Pro);
//     gemini-3.5-flash-lite is the most cost-effective.
//   - Claude: claude-opus-5-5 is the recommended flagship; claude-haiku-5-5 the cheapest.
//
// Each engine offers exactly two options: newest flagship and cheapest.
// IDs removed from `options` must be added to MODEL_ALIASES so saved settings
// keep working.

import type { AiEngine } from '@/src/storage/types';

export interface ModelOption {
  value: string;
  label: string;
}

interface EngineModels {
  defaultModel: string;
  options: ModelOption[];
}

export const MODEL_REGISTRY: Record<AiEngine, EngineModels> = {
  openai: {
    defaultModel: 'gpt-6-luna',
    options: [
      { value: 'gpt-6-astra', label: 'gpt-6-astra' },
      { value: 'gpt-6-luna', label: 'gpt-6-luna' },
    ],
  },
  deepseek: {
    defaultModel: 'deepseek-flash',
    options: [
      { value: 'deepseek-v4-pro', label: 'deepseek-v4-pro' },
      { value: 'deepseek-flash', label: 'deepseek-flash' },
    ],
  },
  gemini: {
    defaultModel: 'gemini-3.8-flash',
    options: [
      { value: 'gemini-3.8-flash', label: 'gemini-3.8-flash' },
      { value: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite' },
    ],
  },
  claude: {
    defaultModel: 'claude-haiku-5-5',
    options: [
      { value: 'claude-opus-5-5', label: 'claude-opus-5-5' },
      { value: 'claude-haiku-5-5', label: 'claude-haiku-5-5' },
    ],
  },
};

/** Retired or delisted model ID -> the option that replaces it. */
export const MODEL_ALIASES: Record<AiEngine, Record<string, string>> = {
  openai: { 'gpt-5.4-nano': 'gpt-6-luna' },
  deepseek: {},
  gemini: {},
  claude: {},
};

export function getModelOptions(engine: AiEngine): ModelOption[] {
  return MODEL_REGISTRY[engine].options;
}

export function getDefaultModel(engine: AiEngine): string {
  return MODEL_REGISTRY[engine].defaultModel;
}

/**
 * Map a saved model ID to one the vendor accepts today.
 * Empty or unknown IDs resolve to the engine default.
 */
export function resolveModel(engine: AiEngine, model: string | undefined): string {
  const aliased = (model && MODEL_ALIASES[engine][model]) || model;
  const known = MODEL_REGISTRY[engine].options.some((option) => option.value === aliased);
  return known && aliased ? aliased : getDefaultModel(engine);
}
