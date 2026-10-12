import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getApiKeys, getSettings } from '@/src/storage/items';
import { getAdBlock, saveAdBlock, saveApiKeys, saveSettings } from '@/src/storage/settings';
import { DEFAULT_AD_BLOCK, DEFAULT_SETTINGS } from '@/src/storage/types';

describe('settings helpers', () => {
  beforeEach(() => fakeBrowser.reset());
  afterEach(() => vi.restoreAllMocks());

  it('writes API keys to local only, never to sync', async () => {
    const syncSet = vi.spyOn(fakeBrowser.storage.sync, 'set');
    await saveApiKeys({ openai: '  sk-openai  ', claude: 'sk-ant' });
    await saveApiKeys({ gemini: 'g-key' });

    expect(syncSet).not.toHaveBeenCalled();
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
    expect(await getApiKeys()).toEqual({ openai: 'sk-openai', deepseek: '', gemini: 'g-key', claude: 'sk-ant' });
    expect(JSON.stringify(await fakeBrowser.storage.local.get(null))).toContain('sk-ant');
  });

  it('merges settings patches over the stored settings', async () => {
    await saveSettings({ aiEngine: 'claude', autoTranslate: true });
    await saveSettings({ models: { ...DEFAULT_SETTINGS.models, claude: 'claude-opus-5-5' } });
    expect(await getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      aiEngine: 'claude',
      autoTranslate: true,
      models: { ...DEFAULT_SETTINGS.models, claude: 'claude-opus-5-5' },
    });
    expect(Object.keys(await fakeBrowser.storage.local.get(null))).toEqual([]);
  });

  it('defaults ad blocking to off and saves each platform independently', async () => {
    expect(await getAdBlock()).toEqual(DEFAULT_AD_BLOCK);
    await saveAdBlock({ x: true });
    expect(await getAdBlock()).toEqual({ reddit: false, x: true, facebook: false });
  });

  it('surfaces write failures as storage-error', async () => {
    vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValue(new Error('MAX_WRITE_OPERATIONS_PER_HOUR quota exceeded'));
    await expect(saveSettings({ fontSize: 'large' })).rejects.toMatchObject({ code: 'storage-error' });
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('disk full'));
    await expect(saveApiKeys({ openai: 'k' })).rejects.toMatchObject({ code: 'storage-error' });
  });
});
