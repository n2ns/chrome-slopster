import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerHandlers, sendToBackground, type BackgroundMessages } from '@/src/messaging/protocol';
import { AppError } from '@/src/providers/types';

describe('messaging protocol', () => {
  beforeEach(() => fakeBrowser.reset());

  it('round-trips a typed request and response', async () => {
    registerHandlers<BackgroundMessages>({
      translate: async ({ text, targetLanguage }) => ({ text: `${text}->${targetLanguage}`, truncated: false }),
    });
    await expect(sendToBackground('translate', { text: 'hi', targetLanguage: 'zh-CN' })).resolves.toEqual({ text: 'hi->zh-CN', truncated: false });
  });

  it('rethrows handler AppErrors with code and status on the sender side', async () => {
    registerHandlers<BackgroundMessages>({
      translate: async () => {
        throw new AppError('rate-limited', 'Too many requests', 429);
      },
    });
    const error = await sendToBackground('translate', { text: 'hi' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'rate-limited', status: 429, message: 'Too many requests' });
  });

  it('maps unexpected errors to internal-error', async () => {
    registerHandlers<BackgroundMessages>({
      translate: async () => {
        throw new TypeError('boom');
      },
    });
    await expect(sendToBackground('translate', { text: 'hi' })).rejects.toMatchObject({ code: 'internal-error' });
  });
});
