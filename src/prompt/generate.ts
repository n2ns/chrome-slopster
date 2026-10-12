// Handles a generation request end to end: settings, prompt, provider, parsing.

import { resolveModel } from '@/src/models/registry';
import { AI_PROVIDERS } from '@/src/providers';
import { AppError } from '@/src/providers/types';
import { getApiKeys, getSettings } from '@/src/storage/items';
import { isAiEngine } from '@/src/storage/types';
import { buildGenerationPrompt } from './build';
import { parseGenerationOutput } from './parse';
import type { GenerationRequest, GenerationResult } from './types';

export async function generateDraft(request: GenerationRequest): Promise<GenerationResult> {
  const [settings, keys] = await Promise.all([getSettings(), getApiKeys()]);
  const engine = settings.aiEngine;
  if (!isAiEngine(engine)) throw new AppError('unsupported-engine', `Unsupported AI engine: ${String(engine)}`);

  const { system, prompt } = buildGenerationPrompt(request);
  const raw = await AI_PROVIDERS[engine].generate(
    { system, prompt, json: true },
    { apiKey: keys[engine], model: resolveModel(engine, settings.models[engine]) },
  );
  return { raw, parsed: parseGenerationOutput(raw) };
}
