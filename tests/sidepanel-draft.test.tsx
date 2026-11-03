import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DraftResult } from '@/entrypoints/sidepanel/draft';

describe.each(['reply', 'post'] as const)('X %s draft count', (mode) => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(fakeBrowser.i18n, 'getMessage').mockImplementation(((key: string, subs?: string | string[]) =>
      subs === undefined ? key : `${key}(${([] as string[]).concat(subs).join(',')})`) as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['Chinese at the limit', '中'.repeat(140), 280],
    ['Chinese over the limit', '中'.repeat(141), 282],
    ['emoji', '😀'.repeat(141), 282],
    ['joined emoji', '👨‍👩‍👧‍👦', 2],
    ['a shortened URL', `https://example.com/${'a'.repeat(300)}`, 23],
    ['normalized Unicode', 'e\u0301'.repeat(280), 280],
  ])('counts %s using X weights', (_label, draft, length) => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <DraftResult
        mode={mode}
        platform="x"
        generation={{ raw: '{}', parsed: { shouldReply: true, reason: '', reply: draft, replyNative: '', reviewNotes: '' } }}
        draft={draft}
        onDraftChange={() => undefined}
        canCopy
        canFill
        filling={false}
        onCopy={() => undefined}
        onFill={() => undefined}
      />,
    );
    const count = container.querySelector(`#${mode}-count`)!;
    expect(count.textContent).toBe(`replyCharCount(${length},280)`);
    expect(count.className).toBe(length > 280 ? 'error' : 'hint');
    expect(container.textContent?.includes(`${mode}OverLimit(280)`)).toBe(length > 280);
  });
});
