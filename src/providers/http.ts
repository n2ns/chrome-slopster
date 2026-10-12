// Shared HTTP plumbing for every provider: one place that maps fetch failures
// and HTTP statuses to AppError codes.

import { AppError } from './types';

/** How much of an error response body is kept in the error message. */
const ERROR_BODY_SLICE = 300;

/** Output token cap for AI calls; generous enough for an 8000-character translation. */
export const MAX_OUTPUT_TOKENS = 16000;

export function requireApiKey(apiKey: string, label: string): void {
  if (!apiKey.trim()) throw new AppError('missing-api-key', `${label} API key is not configured.`);
}

/** Fetch and decode a JSON response, throwing AppError for every failure mode. */
export async function fetchJson(url: string, init: RequestInit, label: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new AppError('network-error', `${label} request failed: ${String(error)}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const detail = body.trim().slice(0, ERROR_BODY_SLICE);
    const message = `${label} HTTP ${response.status}${detail ? `: ${detail}` : ''}`;
    if (response.status === 429) throw new AppError('rate-limited', message, 429);
    throw new AppError('http-error', message, response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new AppError('bad-response', `${label} returned a response that is not JSON.`);
  }
}

/** Reject empty model output so callers never get a silent blank result. */
export function requireText(text: string, label: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new AppError('bad-response', `${label} returned no text.`);
  return trimmed;
}

export function translationSystemPrompt(targetLanguage: string): string {
  return [
    `You are a professional translator. Translate the user's text into the language with BCP 47 tag "${targetLanguage}".`,
    'Keep the original Markdown, line breaks, HTML tags, and emojis.',
    'Respond with the translation only: no explanation, notes, or preamble.',
  ].join(' ');
}
