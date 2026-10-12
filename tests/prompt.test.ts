import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { ThreadContext } from '@/src/adapters/types';
import { buildGenerationPrompt, MAX_PROMPT_CHARS, parseGenerationOutput } from '@/src/prompt';
import { ANTI_AI_VOICE_RULES } from '@/src/prompt/anti-ai-voice';
import { generateDraft } from '@/src/prompt/generate';
import { PLATFORM_RULES } from '@/src/prompt/platforms';
import type { GenerationRequest } from '@/src/prompt/types';
import { apiKeysItem, settingsItem } from '@/src/storage/items';
import { DEFAULT_SETTINGS, EMPTY_API_KEYS, PLATFORMS, type Persona, type PlatformId } from '@/src/storage/types';
import { stubFetch } from './helpers/fetch-stub';

const persona: Persona = {
  id: 'p1',
  name: 'Sam',
  identity: 'Backend developer.\n\nRuns a small homelab.',
  tone: 'Dry, brief.',
  replyLanguage: 'auto',
  bannedWords: ['synergy', 'leverage'],
  customRules: ['Never use exclamation marks.'],
  antiAiVoice: true,
};

function thread(platform: PlatformId, patch: Partial<ThreadContext> = {}): ThreadContext {
  return {
    platform,
    url: 'https://example.com/post/1',
    community: platform === 'x' ? undefined : 'r/selfhosted',
    author: 'someone',
    title: 'Which   backup\n tool?',
    body: 'First paragraph.\n\nSecond   paragraph.',
    parentChain: [],
    comments: ['Use restic.', 'Borg works too.'],
    ...patch,
  };
}

function request(patch: Partial<GenerationRequest> = {}): GenerationRequest {
  return { mode: 'reply', thread: thread('reddit'), persona, intent: 'Recommend a tool.', operatorLanguage: 'zh-CN', ...patch };
}

describe('buildGenerationPrompt', () => {
  it.each(PLATFORMS)('%s: puts the platform rules at the top and the JSON shape at the end', (platform) => {
    const { system, prompt } = buildGenerationPrompt(request({ thread: thread(platform) }));
    expect(system.length).toBeGreaterThan(0);
    expect(prompt.startsWith(PLATFORM_RULES[platform][0]!)).toBe(true);
    for (const rule of PLATFORM_RULES[platform]) expect(prompt).toContain(rule);
    expect(prompt.trimEnd().endsWith('}')).toBe(true);
    expect(prompt).toContain('"should_reply"');
    expect(prompt).toContain('"reply_native"');
    expect(prompt).toContain('"review_notes"');
  });

  it('every platform forbids fabrication, impersonation, hidden affiliation or AI drafting, and boilerplate', () => {
    for (const platform of PLATFORMS) {
      const rules = PLATFORM_RULES[platform].join('\n');
      expect(rules).toMatch(/fabricate first-hand experience/);
      expect(rules).toMatch(/impersonate/);
      expect(rules).toMatch(/hide an affiliation/);
      expect(rules).toMatch(/AI-assisted draft/);
      expect(rules).toMatch(/boilerplate/);
      expect(rules).toMatch(/override everything else/);
    }
  });

  it('writes the 280-character limit into X prompts only', () => {
    expect(buildGenerationPrompt(request({ thread: thread('x') })).prompt).toContain('280 characters');
    expect(buildGenerationPrompt(request()).prompt).not.toContain('280 characters');
  });

  it('uses one shared system prompt for every platform and mode', () => {
    const systems = new Set(
      PLATFORMS.flatMap((platform) => [
        buildGenerationPrompt(request({ thread: thread(platform) })).system,
        buildGenerationPrompt(request({ thread: thread(platform), mode: 'post' })).system,
      ]),
    );
    expect(systems.size).toBe(1);
  });

  it('includes anti-AI-voice rules only when the persona enables them', () => {
    const on = buildGenerationPrompt(request()).prompt;
    const off = buildGenerationPrompt(request({ persona: { ...persona, antiAiVoice: false } })).prompt;
    expect(on).toContain(ANTI_AI_VOICE_RULES[0]);
    for (const rule of ANTI_AI_VOICE_RULES) expect(off).not.toContain(rule);
  });

  it('always includes banned words and custom rules', () => {
    const off = buildGenerationPrompt(request({ persona: { ...persona, antiAiVoice: false } })).prompt;
    expect(off).toContain('synergy, leverage');
    expect(off).toContain('Never use exclamation marks.');
  });

  it('contains no promotion fields or link instructions', () => {
    for (const mode of ['reply', 'post'] as const) {
      const { system, prompt } = buildGenerationPrompt(request({ mode }));
      const text = `${system}\n${prompt}`.toLowerCase();
      for (const banned of ['suggested_link', 'fit_score', 'utm_', 'tracked link', 'product information', 'project information', 'promotion fit']) {
        expect(text).not.toContain(banned);
      }
    }
  });

  it('collapses single-line fields and keeps paragraphs in multi-line fields', () => {
    const { prompt } = buildGenerationPrompt(request());
    expect(prompt).toContain('- Title: Which backup tool?');
    expect(prompt).toContain('First paragraph.\n\nSecond paragraph.');
    expect(prompt).toContain('Backend developer.\n\nRuns a small homelab.');
  });

  it('asks for a title in post mode only', () => {
    expect(buildGenerationPrompt(request({ mode: 'post' })).prompt).toContain('"title"');
    expect(buildGenerationPrompt(request()).prompt).not.toContain('"title"');
  });

  it('names the reply language and the operator language', () => {
    const auto = buildGenerationPrompt(request()).prompt;
    expect(auto).toContain('same language as the content you are replying to');
    expect(auto).toContain('"zh-CN"');
    const fixed = buildGenerationPrompt(request({ persona: { ...persona, replyLanguage: 'en-US' } })).prompt;
    expect(fixed).toContain('"en-US"');
  });

  it.each(PLATFORMS)('%s: stays within budget and keeps the rules and JSON block when context is huge', (platform) => {
    const huge = 'word '.repeat(10_000);
    const { prompt } = buildGenerationPrompt(
      request({
        thread: thread(platform, { body: huge, parentChain: [huge, huge, huge, huge], comments: [huge, huge, huge, huge, huge] }),
        intent: huge,
        persona: { ...persona, identity: huge, customRules: Array.from({ length: 50 }, () => huge) },
      }),
    );
    expect(prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    for (const rule of PLATFORM_RULES[platform]) expect(prompt).toContain(rule);
    expect(prompt).toContain('[Context truncated to fit the prompt budget.]');
    expect(prompt).toContain('JSON shape:');
    expect(prompt.trimEnd().endsWith('}')).toBe(true);
  });
});

describe('parseGenerationOutput', () => {
  const full = {
    should_reply: true,
    reason: 'Relevant',
    reply: 'Try restic.',
    reply_native: '试试 restic。',
    review_notes: 'Check rules',
  };

  it('parses a clean object', () => {
    expect(parseGenerationOutput(JSON.stringify(full))).toEqual({
      shouldReply: true,
      reason: 'Relevant',
      reply: 'Try restic.',
      replyNative: '试试 restic。',
      reviewNotes: 'Check rules',
    });
  });

  it('strips code fences and surrounding prose', () => {
    const raw = `Here you go:\n\`\`\`json\n${JSON.stringify(full)}\n\`\`\`\nThanks`;
    expect(parseGenerationOutput(raw)?.reply).toBe('Try restic.');
  });

  it('finds the object when the reply itself contains braces and fences', () => {
    const raw = `note ${JSON.stringify({ ...full, reply: 'Use ```{ "a": 1 }``` in config' })} trailing`;
    expect(parseGenerationOutput(raw)?.reply).toBe('Use ```{ "a": 1 }``` in config');
  });

  it('tolerates trailing commas', () => {
    expect(parseGenerationOutput('{"reply": "hi", "should_reply": true,}')?.reply).toBe('hi');
  });

  it.each([false, 'false', 'False', 'no', 0, '0', '否'])('treats %j as should_reply = false', (value) => {
    expect(parseGenerationOutput(JSON.stringify({ ...full, should_reply: value }))?.shouldReply).toBe(false);
  });

  it.each([true, 'true', 'yes', 1, undefined])('treats %j as should_reply = true', (value) => {
    expect(parseGenerationOutput(JSON.stringify({ ...full, should_reply: value }))?.shouldReply).toBe(true);
  });

  it('turns non-string text fields into empty strings', () => {
    const parsed = parseGenerationOutput(JSON.stringify({ ...full, reason: { a: 1 }, reply_native: 5, review_notes: ['x'] }));
    expect(parsed).toMatchObject({ reason: '', replyNative: '', reviewNotes: '' });
  });

  it('keeps a title only when present', () => {
    expect(parseGenerationOutput(JSON.stringify({ ...full, title: ' A title ' }))?.title).toBe('A title');
    expect(parseGenerationOutput(JSON.stringify({ ...full, title: '' }))).not.toHaveProperty('title');
  });

  it.each([
    ['empty output', ''],
    ['no JSON', 'I cannot help with that.'],
    ['an array', '[1, 2]'],
    ['an empty reply', JSON.stringify({ ...full, reply: '  ' })],
    ['a non-string reply', JSON.stringify({ ...full, reply: { text: 'x' } })],
    ['truncated JSON', '{"reply": "cut off'],
  ])('returns null for %s', (_label, raw) => {
    expect(parseGenerationOutput(raw)).toBeNull();
  });
});

describe('generateDraft', () => {
  beforeEach(() => fakeBrowser.reset());
  afterEach(() => vi.unstubAllGlobals());

  it('calls the selected engine with the resolved model and returns raw plus parsed output', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, aiEngine: 'claude', models: { ...DEFAULT_SETTINGS.models, claude: 'claude-retired' } });
    await apiKeysItem.setValue({ ...EMPTY_API_KEYS, claude: 'sk-ant' });
    const raw = JSON.stringify({ should_reply: 'no', reason: 'r', reply: 'hello', reply_native: '你好', review_notes: 'n' });
    const { calls } = stubFetch({ json: { content: [{ type: 'text', text: raw }], stop_reason: 'end_turn' } });

    const result = await generateDraft(request());
    expect(result.raw).toBe(raw);
    expect(result.parsed).toMatchObject({ shouldReply: false, reply: 'hello' });
    const body = calls[0]!.body as { model: string; system: string };
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.system).toBe(buildGenerationPrompt(request()).system);
  });

  it('returns parsed = null for unusable output', async () => {
    await apiKeysItem.setValue({ ...EMPTY_API_KEYS, gemini: 'g' });
    stubFetch({ json: { candidates: [{ content: { parts: [{ text: 'not json' }] } }] } });
    await expect(generateDraft(request())).resolves.toEqual({ raw: 'not json', parsed: null });
  });

  it('reports a missing key for the selected engine', async () => {
    stubFetch();
    await expect(generateDraft(request())).rejects.toMatchObject({ code: 'missing-api-key' });
  });
});
