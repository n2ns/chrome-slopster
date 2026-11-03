import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getApiKeys, getSettings } from '@/src/storage/items';
import { getAdBlock, saveAdBlock, saveApiKeys, saveSettings } from '@/src/storage/settings';
import { DEFAULT_AD_BLOCK, DEFAULT_SETTINGS } from '@/src/storage/types';
import { installLocksPolyfill } from './helpers/browser';

describe('settings helpers', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    installLocksPolyfill();
  });
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

  it('preserves independent settings saved concurrently', async () => {
    await Promise.all([saveSettings({ autoTranslate: true }), saveSettings({ hideOriginal: true })]);

    expect(await getSettings()).toMatchObject({ autoTranslate: true, hideOriginal: true });
  });

  it('preserves ad blocking changes to different platforms saved concurrently', async () => {
    await Promise.all([saveAdBlock({ x: true }), saveAdBlock({ reddit: true })]);

    expect(await getAdBlock()).toEqual({ reddit: true, x: true, facebook: false });
  });

  it('preserves keys for different engines saved concurrently in local storage', async () => {
    const syncSet = vi.spyOn(fakeBrowser.storage.sync, 'set');
    await Promise.all([saveApiKeys({ openai: '  openai-key  ' }), saveApiKeys({ claude: '  claude-key  ' })]);

    expect(await getApiKeys()).toMatchObject({ openai: 'openai-key', claude: 'claude-key' });
    expect(syncSet).not.toHaveBeenCalled();
  });

  it.each([
    ['settings', 'sync', () => saveSettings({ fontSize: 'large' }), async () => expect((await getSettings()).fontSize).toBe('large')],
    ['ad blocking', 'sync', () => saveAdBlock({ x: true }), async () => expect((await getAdBlock()).x).toBe(true)],
    ['API keys', 'local', () => saveApiKeys({ openai: 'openai-key' }), async () => expect((await getApiKeys()).openai).toBe('openai-key')],
  ] as const)('releases the %s save lock after a failed write', async (_name, area, save, verify) => {
    vi.spyOn(fakeBrowser.storage[area], 'set').mockRejectedValueOnce(new Error('storage write failed'));
    const [failed, succeeded] = await Promise.allSettled([save(), save()]);

    expect(failed).toMatchObject({ status: 'rejected', reason: { code: 'storage-error' } });
    expect(succeeded.status).toBe('fulfilled');
    await verify();
  });

  it('surfaces write failures as storage-error', async () => {
    vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValue(new Error('MAX_WRITE_OPERATIONS_PER_HOUR quota exceeded'));
    await expect(saveSettings({ fontSize: 'large' })).rejects.toMatchObject({ code: 'storage-error' });
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('disk full'));
    await expect(saveApiKeys({ openai: 'k' })).rejects.toMatchObject({ code: 'storage-error' });
  });
});
