// Shared HTTP plumbing for every provider: one place that maps fetch failures
// and HTTP statuses to AppError codes.

import { AppError } from './types';

/** How much of an error response body is kept in the error message. */
const ERROR_BODY_SLICE = 300;

/** Per-attempt deadline, including response headers and the complete body. */
const REQUEST_TIMEOUT_MS = 25_000;

/** Output token cap for AI calls; generous enough for an 8000-character translation. */
export const MAX_OUTPUT_TOKENS = 16000;

export function requireApiKey(apiKey: string, label: string): void {
  if (!apiKey.trim()) throw new AppError('missing-api-key', `${label} API key is not configured.`);
}

/** Fetch and decode a JSON response, throwing AppError for every failure mode. */
export async function fetchJson(url: string, init: RequestInit, label: string): Promise<unknown> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abortFromCaller();
  else init.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out.', 'TimeoutError')), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      throw new AppError('network-error', `${label} request failed: ${String(error)}`);
    }

    if (!response.ok) {
      // A stalled error body must not turn a known 429 or other status into a network error.
      const body = await response.text().catch(() => '');
      const detail = body.trim().slice(0, ERROR_BODY_SLICE);
      const message = `${label} HTTP ${response.status}${detail ? `: ${detail}` : ''}`;
      if (response.status === 429) throw new AppError('rate-limited', message, 429);
      throw new AppError('http-error', message, response.status);
    }

    try {
      return await response.json();
    } catch {
      if (controller.signal.aborted) throw new AppError('network-error', `${label} request failed: ${String(controller.signal.reason)}`);
      throw new AppError('bad-response', `${label} returned a response that is not JSON.`);
    }
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abortFromCaller);
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
