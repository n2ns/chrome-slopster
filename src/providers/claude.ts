// Anthropic Messages API, called directly from the extension.
//
// Checked against https://platform.claude.com/docs (2026-10-12):
// - Browser calls need `anthropic-dangerous-direct-browser-access: true`.
// - Reliable JSON comes from structured outputs: `output_config.format` with a
//   `json_schema` (GA, no beta header); the JSON arrives as text in a text block.
// - Current models reject sampling parameters and always think, so the request
//   sets no temperature and skips non-text (thinking) blocks in the response.

import { GENERATION_OUTPUT_SCHEMA } from '@/src/prompt/output-schema';
import { fetchJson, MAX_OUTPUT_TOKENS, requireApiKey, requireText, translationSystemPrompt } from './http';
import { AppError, type AiProvider, type ProviderCallOptions } from './types';

const LABEL = 'Claude';
export const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

interface MessagesResponse {
  content?: { type?: unknown; text?: unknown }[];
  stop_reason?: unknown;
}

async function createMessage(system: string, user: string, json: boolean, options: ProviderCallOptions): Promise<string> {
  requireApiKey(options.apiKey, LABEL);
  const data = (await fetchJson(
    CLAUDE_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
        ...(json ? { output_config: { format: { type: 'json_schema', schema: GENERATION_OUTPUT_SCHEMA } } } : {}),
      }),
      signal: options.signal,
    },
    LABEL,
  )) as MessagesResponse | null;

  if (data?.stop_reason === 'refusal') throw new AppError('bad-response', `${LABEL} declined the request.`);
  const blocks = data?.content;
  if (!Array.isArray(blocks)) throw new AppError('bad-response', `Unexpected response format from ${LABEL}.`);
  const text = blocks
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');
  return requireText(text, LABEL);
}

export const claudeProvider: AiProvider = {
  id: 'claude',
  translate: (text, targetLanguage, options) => createMessage(translationSystemPrompt(targetLanguage), text, false, options),
  generate: (input, options) => createMessage(input.system, input.prompt, input.json, options),
};
