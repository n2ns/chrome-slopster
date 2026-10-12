// OpenAI and DeepSeek share the Chat Completions request and response format;
// only the endpoint and label differ.

import type { AiEngine } from '@/src/storage/types';
import { fetchJson, requireApiKey, requireText, translationSystemPrompt } from './http';
import { AppError, type AiProvider, type ProviderCallOptions } from './types';

interface OpenAiCompatibleConfig {
  id: AiEngine;
  label: string;
  endpoint: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: unknown } }[];
}

export function createOpenAiCompatibleProvider({ id, label, endpoint }: OpenAiCompatibleConfig): AiProvider {
  async function chat(system: string, user: string, json: boolean, options: ProviderCallOptions): Promise<string> {
    requireApiKey(options.apiKey, label);
    const data = (await fetchJson(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey}` },
        body: JSON.stringify({
          model: options.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: options.signal,
      },
      label,
    )) as ChatCompletionResponse | null;

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AppError('bad-response', `Unexpected response format from ${label}.`);
    return requireText(content, label);
  }

  return {
    id,
    translate: (text, targetLanguage, options) => chat(translationSystemPrompt(targetLanguage), text, false, options),
    generate: (input, options) => chat(input.system, input.prompt, input.json, options),
  };
}

export const openAiProvider = createOpenAiCompatibleProvider({
  id: 'openai',
  label: 'OpenAI',
  endpoint: 'https://api.openai.com/v1/chat/completions',
});

export const deepSeekProvider = createOpenAiCompatibleProvider({
  id: 'deepseek',
  label: 'DeepSeek',
  endpoint: 'https://api.deepseek.com/chat/completions',
});
