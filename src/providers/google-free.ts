// Free Google Translate endpoint (no API key). Translation only, so it is not
// part of AI_PROVIDERS. The text goes in a POST form body: in the query string,
// a few thousand CJK characters exceed Google's URL length limit (HTTP 400).
// Server errors and network failures are retried with exponential backoff and
// jitter. A 429 is not retried, so the caller starts its cooldown at once;
// other 4xx and bad response shapes are thrown immediately.

import { fetchJson } from './http';
import { AppError } from './types';

const LABEL = 'Google Translate';
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

export interface GoogleFreeOptions {
  /** Total attempts, including the first. */
  attempts?: number;
  /** Base backoff delay; doubles per attempt, plus up to 200 ms jitter. */
  baseDelayMs?: number;
  signal?: AbortSignal;
}

export function googleFreeUrl(targetLanguage: string): string {
  const params = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: targetLanguage, dt: 't' });
  return `${ENDPOINT}?${params.toString()}`;
}

/** The response is a nested array: [[[translated, source, ...], ...], ...]. */
function parseResponse(data: unknown): string {
  const segments = Array.isArray(data) ? (data[0] as unknown) : null;
  if (!Array.isArray(segments)) throw new AppError('bad-response', `Unexpected response format from ${LABEL}.`);
  const text = segments
    .map((segment: unknown) => (Array.isArray(segment) ? segment[0] : ''))
    .filter((piece): piece is string => typeof piece === 'string')
    .join('');
  if (!text.trim()) throw new AppError('bad-response', `${LABEL} returned no text.`);
  return text;
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof AppError)) return false;
  if (error.code === 'network-error') return true;
  return error.code === 'http-error' && (error.status ?? 0) >= 500;
}

export async function translateGoogleFree(text: string, targetLanguage: string, options: GoogleFreeOptions = {}): Promise<string> {
  const { attempts = 3, baseDelayMs = 350, signal } = options;
  const url = googleFreeUrl(targetLanguage);

  for (let attempt = 1; ; attempt += 1) {
    try {
      // A fresh body per attempt; fetch consumes it.
      const body = new URLSearchParams({ q: text });
      return parseResponse(await fetchJson(url, { method: 'POST', body, signal }, LABEL));
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      const jitter = baseDelayMs > 0 ? Math.random() * 200 : 0;
      const delay = baseDelayMs * 2 ** (attempt - 1) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
