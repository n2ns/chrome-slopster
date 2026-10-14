import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { AppError } from '@/src/providers/types';
import { apiKeysItem, googleFreeCooldownAtItem, settingsItem } from '@/src/storage/items';
import { DEFAULT_SETTINGS, EMPTY_API_KEYS, type Settings } from '@/src/storage/types';
import { AI_TRANSLATION_MAX_CHARS, GOOGLE_FREE_MAX_CHARS, limitProviderText } from '@/src/translation/limits';
import { createQueue } from '@/src/translation/queue';
import { GOOGLE_FREE_COOLDOWN_MS, translateText } from '@/src/translation/translate';
import { stubFetch } from './helpers/fetch-stub';

const GOOGLE_OK = (text: string) => ({ json: [[[text, 'src']]] });
const GEMINI_OK = (text: string) => ({ json: { candidates: [{ content: { parts: [{ text }] } }] } });

/** Run a promise to completion while fake timers drive queue stagger and retry backoff. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const outcome = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const result = await outcome;
  if ('error' in result) throw result.error;
  return result.value;
}

async function setSettings(patch: Partial<Settings>): Promise<void> {
  await settingsItem.setValue({ ...DEFAULT_SETTINGS, ...patch });
}

describe('translation queue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs at most `concurrency` tasks at once and staggers their start', async () => {
    const enqueue = createQueue({ concurrency: 3, minStaggerMs: 40, maxStaggerMs: 80 });
    let running = 0;
    let peak = 0;
    let started = 0;
    const release: (() => void)[] = [];
    const task = () =>
      new Promise<void>((resolve) => {
        started += 1;
        running += 1;
        peak = Math.max(peak, running);
        release.push(() => {
          running -= 1;
          resolve();
        });
      });

    const all = Promise.all(Array.from({ length: 7 }, () => enqueue(task)));
    await vi.advanceTimersByTimeAsync(39);
    expect(started).toBe(0);
    await vi.advanceTimersByTimeAsync(41);
    expect(started).toBe(3);

    while (release.length > 0) {
      release.shift()!();
      await vi.advanceTimersByTimeAsync(80);
    }
    await all;
    expect(started).toBe(7);
    expect(peak).toBe(3);
  });

  it('does not wedge when a task throws synchronously', async () => {
    const enqueue = createQueue({ concurrency: 1, minStaggerMs: 0, maxStaggerMs: 0 });
    const bad = enqueue((() => {
      throw new Error('sync boom');
    }) as () => Promise<never>);
    const good = enqueue(async () => 'still running');

    const badOutcome = bad.catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    await expect(badOutcome).resolves.toMatchObject({ message: 'sync boom' });
    await expect(good).resolves.toBe('still running');
  });

  it('passes rejections through and keeps going', async () => {
    const enqueue = createQueue({ concurrency: 1, minStaggerMs: 0, maxStaggerMs: 0 });
    const failed = enqueue(() => Promise.reject(new Error('async boom'))).catch((error: unknown) => error);
    const ok = enqueue(async () => 42);
    await vi.runAllTimersAsync();
    await expect(failed).resolves.toMatchObject({ message: 'async boom' });
    await expect(ok).resolves.toBe(42);
  });
});

describe('length limits', () => {
  it('passes short text through, trimmed', () => {
    expect(limitProviderText('  hi  ', 10)).toEqual({ text: 'hi', truncated: false });
  });

  it('cuts long text and reports truncation without adding any notice', () => {
    const result = limitProviderText('a'.repeat(20), 8);
    expect(result).toEqual({ text: 'a'.repeat(8), truncated: true });
  });

  it('never splits a surrogate pair', () => {
    const result = limitProviderText(`abc${'😀'.repeat(5)}`, 4);
    expect(result.text).toBe('abc');
    expect(result.truncated).toBe(true);
  });
});

describe('translateText', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.spyOn(browser.i18n, 'getUILanguage').mockReturnValue('zh-CN');
    await apiKeysItem.setValue({ ...EMPTY_API_KEYS, gemini: 'gem-key' });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses Google free and resolves the auto operator language from the browser', async () => {
    const { calls } = stubFetch(GOOGLE_OK('你好'));
    await expect(settle(translateText('hello'))).resolves.toEqual({ text: '你好', truncated: false });
    expect(new URL(calls[0]!.url).searchParams.get('tl')).toBe('zh-CN');
  });

  it('prefers an explicit target language and a configured operator language', async () => {
    await setSettings({ operatorLanguage: 'ja' });
    const { calls } = stubFetch(GOOGLE_OK('a'), GOOGLE_OK('b'));
    await settle(translateText('hello'));
    await settle(translateText('hello', 'de'));
    expect(new URL(calls[0]!.url).searchParams.get('tl')).toBe('ja');
    expect(new URL(calls[1]!.url).searchParams.get('tl')).toBe('de');
  });

  it('caps Google free input at 4500 chars and reports truncation', async () => {
    const { calls } = stubFetch(GOOGLE_OK('translated'));
    const result = await settle(translateText('x'.repeat(GOOGLE_FREE_MAX_CHARS + 100)));
    expect(result).toEqual({ text: 'translated', truncated: true });
    expect(calls[0]!.form?.get('q')).toBe('x'.repeat(GOOGLE_FREE_MAX_CHARS));
  });

  it('uses the selected AI engine with an 8000-char cap', async () => {
    await setSettings({ translationEngine: 'ai', aiEngine: 'gemini' });
    const { calls } = stubFetch(GEMINI_OK('done'));
    const result = await settle(translateText('y'.repeat(AI_TRANSLATION_MAX_CHARS + 1)));
    expect(result).toEqual({ text: 'done', truncated: true });
    const body = calls[0]!.body as { contents: { parts: { text: string }[] }[] };
    expect(body.contents[0]!.parts[0]!.text).toBe('y'.repeat(AI_TRANSLATION_MAX_CHARS));
    expect(calls[0]!.url).toContain('generativelanguage.googleapis.com');
  });

  it('starts a cooldown after a Google 429 and rethrows without fallback', async () => {
    vi.setSystemTime(1_000_000);
    const { fetchMock } = stubFetch({ status: 429 });
    await expect(settle(translateText('hello'))).rejects.toMatchObject({ code: 'rate-limited' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const startedAt = await googleFreeCooldownAtItem.getValue();
    expect(startedAt).toBeGreaterThanOrEqual(1_000_000);
    expect(startedAt).toBeLessThan(1_000_000 + 1_000);
  });

  it('refuses Google free during the cooldown when fallback is off', async () => {
    vi.setSystemTime(10_000_000);
    await googleFreeCooldownAtItem.setValue(10_000_000 - GOOGLE_FREE_COOLDOWN_MS + 1000);
    const { fetchMock } = stubFetch();
    const error = await settle(translateText('hello')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'rate-limited' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('routes to the AI engine during the cooldown when fallback is on', async () => {
    await setSettings({ aiFallback: true, aiEngine: 'gemini' });
    vi.setSystemTime(10_000_000);
    await googleFreeCooldownAtItem.setValue(10_000_000 - 1000);
    const { calls } = stubFetch(GEMINI_OK('via ai'));
    await expect(settle(translateText('hello'))).resolves.toEqual({ text: 'via ai', truncated: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('generativelanguage.googleapis.com');
  });

  it('uses Google free again once the cooldown has expired', async () => {
    vi.setSystemTime(10_000_000);
    await googleFreeCooldownAtItem.setValue(10_000_000 - GOOGLE_FREE_COOLDOWN_MS);
    const { calls } = stubFetch(GOOGLE_OK('back'));
    await expect(settle(translateText('hello'))).resolves.toEqual({ text: 'back', truncated: false });
    expect(calls[0]!.url).toContain('translate.googleapis.com');
  });

  it('falls back to the AI engine when Google fails, applying the AI cap to the original text', async () => {
    await setSettings({ aiFallback: true, aiEngine: 'gemini' });
    const long = 'z'.repeat(GOOGLE_FREE_MAX_CHARS + 10);
    const { calls } = stubFetch({ status: 400, text: 'bad' }, GEMINI_OK('fallback'));
    await expect(settle(translateText(long))).resolves.toEqual({ text: 'fallback', truncated: false });
    const body = calls[1]!.body as { contents: { parts: { text: string }[] }[] };
    expect(body.contents[0]!.parts[0]!.text).toBe(long);
  });

  it('falls back after a 429 and still records the cooldown', async () => {
    await setSettings({ aiFallback: true, aiEngine: 'gemini' });
    stubFetch({ status: 429 }, GEMINI_OK('fallback'));
    await expect(settle(translateText('hello'))).resolves.toEqual({ text: 'fallback', truncated: false });
    expect(await googleFreeCooldownAtItem.getValue()).toBeGreaterThan(0);
  });

  it('keeps the Google error when the fallback engine has no API key', async () => {
    await setSettings({ aiFallback: true, aiEngine: 'claude' });
    const { fetchMock } = stubFetch({ status: 400, text: 'bad' });
    await expect(settle(translateText('hello'))).rejects.toMatchObject({ code: 'http-error', status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports the cooldown, not a missing key, when the fallback engine has no API key', async () => {
    await setSettings({ aiFallback: true, aiEngine: 'claude' });
    vi.setSystemTime(10_000_000);
    await googleFreeCooldownAtItem.setValue(10_000_000 - 1000);
    const { fetchMock } = stubFetch();
    await expect(settle(translateText('hello'))).rejects.toMatchObject({ code: 'rate-limited' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects empty text', async () => {
    await expect(translateText('   ')).rejects.toMatchObject({ code: 'invalid-request' });
  });
});
