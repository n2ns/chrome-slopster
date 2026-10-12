// Free Google Translate endpoint (no API key). Translation only, so it is not
// part of AI_PROVIDERS. Retries transient failures with exponential backoff and
// jitter; failures a retry cannot fix (4xx other than 429, bad response shape)
// are thrown immediately.

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

export function googleFreeUrl(text: string, targetLanguage: string): string {
  const params = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: targetLanguage, dt: 't', q: text });
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
  if (error.code === 'rate-limited' || error.code === 'network-error') return true;
  return error.code === 'http-error' && (error.status ?? 0) >= 500;
}

export async function translateGoogleFree(text: string, targetLanguage: string, options: GoogleFreeOptions = {}): Promise<string> {
  const { attempts = 3, baseDelayMs = 350, signal } = options;
  const url = googleFreeUrl(text, targetLanguage);

  for (let attempt = 1; ; attempt += 1) {
    try {
      return parseResponse(await fetchJson(url, { signal }, LABEL));
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      const jitter = baseDelayMs > 0 ? Math.random() * 200 : 0;
      const delay = baseDelayMs * 2 ** (attempt - 1) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
