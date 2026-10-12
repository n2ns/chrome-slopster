// Gemini generateContent. The API key goes in the x-goog-api-key header, never
// in the URL, so it cannot leak through URLs in logs or error messages.

import { fetchJson, requireApiKey, requireText, translationSystemPrompt } from './http';
import { AppError, type AiProvider, type ProviderCallOptions } from './types';

const LABEL = 'Gemini';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: unknown; thought?: unknown }[] } }[];
}

export function geminiEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

async function generateContent(system: string, user: string, json: boolean, options: ProviderCallOptions): Promise<string> {
  requireApiKey(options.apiKey, LABEL);
  const data = (await fetchJson(
    geminiEndpoint(options.model),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
      signal: options.signal,
    },
    LABEL,
  )) as GeminiResponse | null;

  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) throw new AppError('bad-response', `Unexpected response format from ${LABEL}.`);
  // Thought summaries are not part of the answer.
  const text = parts
    .filter((part) => part?.thought !== true && typeof part?.text === 'string')
    .map((part) => part.text as string)
    .join('');
  return requireText(text, LABEL);
}

export const geminiProvider: AiProvider = {
  id: 'gemini',
  translate: (text, targetLanguage, options) => generateContent(translationSystemPrompt(targetLanguage), text, false, options),
  generate: (input, options) => generateContent(input.system, input.prompt, input.json, options),
};
