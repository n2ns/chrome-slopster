import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { GENERATION_OUTPUT_SCHEMA } from '@/src/prompt/output-schema';
import { AI_PROVIDERS } from '@/src/providers';
import { translateGoogleFree } from '@/src/providers/google-free';
import { AppError } from '@/src/providers/types';
import { AI_ENGINES, type AiEngine } from '@/src/storage/types';
import { stubFetch } from './helpers/fetch-stub';

const options = { apiKey: 'sk-test', model: 'model-x' };
const input = { system: 'SYS', prompt: 'PROMPT', json: true };

/** A successful response body for each engine that yields `text`. */
function okBody(engine: AiEngine, text: string): unknown {
  switch (engine) {
    case 'openai':
    case 'deepseek':
      return { choices: [{ message: { content: text } }] };
    case 'gemini':
      return { candidates: [{ content: { parts: [{ text }] } }] };
    case 'claude':
      return { content: [{ type: 'text', text }], stop_reason: 'end_turn' };
  }
}

async function expectAppError(promise: Promise<unknown>, code: string, status?: number): Promise<AppError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, ...(status ? { status } : {}) });
  return error as AppError;
}

beforeEach(() => fakeBrowser.reset());
afterEach(() => vi.unstubAllGlobals());

describe.each(AI_ENGINES)('%s provider errors', (engine) => {
  const provider = AI_PROVIDERS[engine];

  it('rejects a missing API key without calling fetch', async () => {
    const { fetchMock } = stubFetch();
    await expectAppError(provider.generate(input, { ...options, apiKey: '  ' }), 'missing-api-key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps HTTP 429 to rate-limited', async () => {
    stubFetch({ status: 429, text: 'slow down' });
    await expectAppError(provider.generate(input, options), 'rate-limited', 429);
  });

  it('maps other non-2xx to http-error with status and a body slice', async () => {
    stubFetch({ status: 401, text: `invalid key ${'x'.repeat(2000)}` });
    const error = await expectAppError(provider.translate('hi', 'fr', options), 'http-error', 401);
    expect(error.message).toContain('invalid key');
    expect(error.message.length).toBeLessThan(400);
  });

  it('maps a fetch rejection to network-error', async () => {
    stubFetch({ reject: new TypeError('Failed to fetch') });
    await expectAppError(provider.generate(input, options), 'network-error');
  });

  it('maps an unexpected shape to bad-response', async () => {
    stubFetch({ json: { unexpected: true } });
    await expectAppError(provider.generate(input, options), 'bad-response');
  });

  it('maps empty text to bad-response', async () => {
    stubFetch({ json: okBody(engine, '   ') });
    await expectAppError(provider.generate(input, options), 'bad-response');
  });

  it('maps a non-JSON body to bad-response', async () => {
    stubFetch({ text: '<html>' });
    await expectAppError(provider.generate(input, options), 'bad-response');
  });

  it('returns the trimmed text on success', async () => {
    stubFetch({ json: okBody(engine, '  {"reply":"ok"}  ') });
    await expect(provider.generate(input, options)).resolves.toBe('{"reply":"ok"}');
  });
});

describe('OpenAI-compatible providers', () => {
  it.each([
    ['openai', 'https://api.openai.com/v1/chat/completions'],
    ['deepseek', 'https://api.deepseek.com/chat/completions'],
  ] as const)('%s sends a Chat Completions request', async (engine, url) => {
    const { calls } = stubFetch({ json: okBody(engine, 'x') }, { json: okBody(engine, 'y') });
    await AI_PROVIDERS[engine].generate(input, options);
    await AI_PROVIDERS[engine].translate('bonjour', 'en', options);

    expect(calls[0]!.url).toBe(url);
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.headers.authorization).toBe('Bearer sk-test');
    expect(calls[0]!.body).toEqual({
      model: 'model-x',
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'PROMPT' },
      ],
      response_format: { type: 'json_object' },
    });
    const translateBody = calls[1]!.body as { messages: { content: string }[]; response_format?: unknown };
    expect(translateBody.response_format).toBeUndefined();
    expect(translateBody.messages[0]!.content).toContain('"en"');
    expect(translateBody.messages[1]!.content).toBe('bonjour');
  });
});

describe('Gemini provider', () => {
  it('puts the key in a header, never in the URL', async () => {
    const { calls } = stubFetch({ json: okBody('gemini', 'x') });
    await AI_PROVIDERS.gemini.generate(input, { ...options, apiKey: 'AIza-secret' });

    expect(calls[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/model-x:generateContent');
    expect(calls[0]!.url).not.toContain('AIza-secret');
    expect(calls[0]!.headers['x-goog-api-key']).toBe('AIza-secret');
    expect(calls[0]!.body).toEqual({
      systemInstruction: { parts: [{ text: 'SYS' }] },
      contents: [{ role: 'user', parts: [{ text: 'PROMPT' }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });
  });

  it('omits the JSON mime type for translation', async () => {
    const { calls } = stubFetch({ json: okBody('gemini', 'x') });
    await AI_PROVIDERS.gemini.translate('hola', 'en', options);
    expect((calls[0]!.body as Record<string, unknown>).generationConfig).toBeUndefined();
  });

  it('concatenates all text parts of the first candidate and skips thoughts', async () => {
    stubFetch({
      json: {
        candidates: [
          { content: { parts: [{ text: 'thinking...', thought: true }, { text: 'Hello, ' }, { text: 'world' }] } },
          { content: { parts: [{ text: 'other candidate' }] } },
        ],
      },
    });
    await expect(AI_PROVIDERS.gemini.generate(input, options)).resolves.toBe('Hello, world');
  });
});

describe('Claude provider', () => {
  it('sends the Messages API request with browser-access headers and structured output', async () => {
    const { calls } = stubFetch({ json: okBody('claude', 'x') });
    await AI_PROVIDERS.claude.generate(input, options);

    expect(calls[0]!.url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0]!.headers).toMatchObject({
      'x-api-key': 'sk-test',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
    const body = calls[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'model-x',
      system: 'SYS',
      messages: [{ role: 'user', content: 'PROMPT' }],
      output_config: { format: { type: 'json_schema', schema: GENERATION_OUTPUT_SCHEMA } },
    });
    expect(body.max_tokens).toBeGreaterThan(0);
  });

  it('omits output_config for translation', async () => {
    const { calls } = stubFetch({ json: okBody('claude', 'x') });
    await AI_PROVIDERS.claude.translate('hola', 'en', options);
    expect((calls[0]!.body as Record<string, unknown>).output_config).toBeUndefined();
  });

  it('concatenates text blocks and ignores thinking blocks', async () => {
    stubFetch({
      json: {
        content: [
          { type: 'thinking', thinking: '' },
          { type: 'text', text: 'Part one. ' },
          { type: 'text', text: 'Part two.' },
        ],
        stop_reason: 'end_turn',
      },
    });
    await expect(AI_PROVIDERS.claude.generate(input, options)).resolves.toBe('Part one. Part two.');
  });

  it('maps a refusal to bad-response', async () => {
    stubFetch({ json: { content: [{ type: 'text', text: 'partial' }], stop_reason: 'refusal' } });
    await expectAppError(AI_PROVIDERS.claude.generate(input, options), 'bad-response');
  });
});

describe('Google free translation', () => {
  const fast = { baseDelayMs: 0 };

  it('POSTs the text as a form body and joins the translated segments', async () => {
    const { calls } = stubFetch({ json: [[['Hello ', 'Bonjour '], ['world', 'monde']], null, 'fr'] });
    await expect(translateGoogleFree('Bonjour monde & co', 'zh-CN', fast)).resolves.toBe('Hello world');

    const url = new URL(calls[0]!.url);
    expect(url.origin + url.pathname).toBe('https://translate.googleapis.com/translate_a/single');
    expect(Object.fromEntries(url.searchParams)).toEqual({ client: 'gtx', sl: 'auto', tl: 'zh-CN', dt: 't' });
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.form?.get('q')).toBe('Bonjour monde & co');
  });

  it('keeps long text out of the URL so it cannot exceed URL length limits', async () => {
    const { calls } = stubFetch({ json: [[['ok', 'src']]] });
    await translateGoogleFree('中'.repeat(4500), 'en', fast);
    expect(calls[0]!.url.length).toBeLessThan(200);
    expect(calls[0]!.form?.get('q')).toBe('中'.repeat(4500));
  });

  it('does not retry a 429, so the caller can start the cooldown at once', async () => {
    const { fetchMock } = stubFetch({ status: 429 });
    await expectAppError(translateGoogleFree('x', 'en', fast), 'rate-limited', 429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries server errors and network failures', async () => {
    stubFetch({ status: 503 }, { reject: new TypeError('offline') }, { json: [[['ok', 'src']]] });
    await expect(translateGoogleFree('x', 'en', fast)).resolves.toBe('ok');
  });

  it('throws network-error when every attempt fails to connect', async () => {
    stubFetch({ reject: new TypeError('offline') }, { reject: new TypeError('offline') }, { reject: new TypeError('offline') });
    await expectAppError(translateGoogleFree('x', 'en', fast), 'network-error');
  });

  it('does not retry a 4xx', async () => {
    const { fetchMock } = stubFetch({ status: 400, text: 'bad' });
    await expectAppError(translateGoogleFree('x', 'en', fast), 'http-error', 400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a bad response shape', async () => {
    const { fetchMock } = stubFetch({ json: { nope: true } });
    await expectAppError(translateGoogleFree('x', 'en', fast), 'bad-response');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
