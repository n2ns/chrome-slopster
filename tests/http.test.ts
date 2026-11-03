import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { translateGoogleFree } from '@/src/providers/google-free';
import { fetchJson } from '@/src/providers/http';
import { apiKeysItem, settingsItem } from '@/src/storage/items';
import { DEFAULT_SETTINGS, EMPTY_API_KEYS } from '@/src/storage/types';
import { createQueue } from '@/src/translation/queue';
import { translateText } from '@/src/translation/translate';

const DEADLINE_MS = 25_000;

/** Model fetch cancellation both before headers and while reading a response body. */
function stalledFetch(phase: 'headers' | 'body', status = 200) {
  const signals: (AbortSignal | null | undefined)[] = [];
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const signal = init?.signal;
    signals.push(signal);
    if (phase === 'headers') {
      return new Promise((_resolve, reject) => {
        if (signal?.aborted) reject(signal.reason);
        else signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    const body = new ReadableStream({
      start(controller) {
        if (signal?.aborted) controller.error(signal.reason);
        else signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true });
      },
    });
    return Promise.resolve(new Response(body, { status }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, signals };
}

describe('provider request deadlines', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['headers', 'body'] as const)('aborts stalled %s at the deadline as network-error', async (phase) => {
    const { signals } = stalledFetch(phase);
    const outcome = fetchJson('https://example.test', {}, 'Test').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS - 1);
    expect(signals[0]?.aborted).not.toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(signals[0]?.aborted).toBe(true);
    await expect(outcome).resolves.toMatchObject({ code: 'network-error' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([429, 401, 503])('preserves HTTP %s when the error body times out', async (status) => {
    const { signals } = stalledFetch('body', status);
    const outcome = fetchJson('https://example.test', {}, 'Test').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    expect(signals[0]?.aborted).toBe(true);
    await expect(outcome).resolves.toMatchObject({ code: status === 429 ? 'rate-limited' : 'http-error', status });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['headers', 'body'] as const)('honors caller cancellation while waiting for %s', async (phase) => {
    const caller = new AbortController();
    const { signals } = stalledFetch(phase);
    const outcome = fetchJson('https://example.test', { signal: caller.signal }, 'Test').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1);
    caller.abort(new Error('Caller cancelled'));
    expect(signals[0]?.aborted).toBe(true);
    await expect(outcome).resolves.toMatchObject({ code: 'network-error' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('honors an already-aborted caller signal', async () => {
    const caller = new AbortController();
    caller.abort();
    stalledFetch('headers');
    await expect(fetchJson('https://example.test', { signal: caller.signal }, 'Test')).rejects.toMatchObject({ code: 'network-error' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up the deadline and caller listener when the response completes', async () => {
    const caller = new AbortController();
    let requestSignal: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal;
      return new Response('{"ok":true}');
    }));
    await expect(fetchJson('https://example.test', { signal: caller.signal }, 'Test')).resolves.toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
    caller.abort();
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    expect(requestSignal?.aborted).toBe(false);
  });

  it('releases all three translation slots so the next request can run', async () => {
    const { fetchMock, signals } = stalledFetch('body');
    const enqueue = createQueue({ concurrency: 3, minStaggerMs: 0, maxStaggerMs: 0 });
    const stalled = Array.from({ length: 3 }, () => enqueue(() => fetchJson('https://example.test', {}, 'Test')).catch((error: unknown) => error));
    const next = vi.fn(async () => 'next translation');
    const later = enqueue(next);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(next).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(signals.every((signal) => signal?.aborted)).toBe(true);
    for (const outcome of stalled) await expect(outcome).resolves.toMatchObject({ code: 'network-error' });
    await expect(later).resolves.toBe('next translation');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not retry a timed-out 429 response body', async () => {
    const { fetchMock, signals } = stalledFetch('body', 429);
    const outcome = translateGoogleFree('hello', 'en', { baseDelayMs: 0 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    expect(signals[0]?.aborted).toBe(true);
    await expect(outcome).resolves.toMatchObject({ code: 'rate-limited', status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry after caller cancellation', async () => {
    const caller = new AbortController();
    const { fetchMock } = stalledFetch('headers');
    const outcome = translateGoogleFree('hello', 'en', { signal: caller.signal, baseDelayMs: 0 }).catch((error: unknown) => error);
    caller.abort();
    await vi.runAllTimersAsync();
    await expect(outcome).resolves.toMatchObject({ code: 'network-error' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries timed-out Google requests and then falls back to the selected AI', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, aiFallback: true });
    await apiKeysItem.setValue({ ...EMPTY_API_KEYS, gemini: 'test-key' });
    const { fetchMock, signals } = stalledFetch('headers');
    const hang = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) => String(input).includes('translate.googleapis.com')
      ? hang(input, init)
      : Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'AI fallback' }] } }] }))));
    const result = translateText('hello', 'en');
    await vi.advanceTimersByTimeAsync(3 * DEADLINE_MS + 5000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal?.aborted)).toBe(true);
    await expect(result).resolves.toEqual({ text: 'AI fallback', truncated: false });
    expect(vi.getTimerCount()).toBe(0);
  });
});
