// Save helpers for the simple storage items. Failures surface as storage-error.

import type { AdBlockSettings, AiEngine, ApiKeys, Settings } from './types';
import { DEFAULT_AD_BLOCK } from './types';
import { toStorageError } from './chunked-sync';
import { adBlockItem, apiKeysItem, getApiKeys, getSettings, settingsItem } from './items';

async function guard(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (error) {
    throw toStorageError(error);
  }
}

/** Merge `patch` into the stored settings. */
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return navigator.locks.request('settings', { mode: 'exclusive' }, async () => {
    const next = { ...(await getSettings()), ...patch };
    await guard(() => settingsItem.setValue(next));
    return next;
  });
}

export async function getAdBlock(): Promise<AdBlockSettings> {
  return { ...DEFAULT_AD_BLOCK, ...(await adBlockItem.getValue()) };
}

export async function saveAdBlock(patch: Partial<AdBlockSettings>): Promise<AdBlockSettings> {
  return navigator.locks.request('adBlock', { mode: 'exclusive' }, async () => {
    const next = { ...(await getAdBlock()), ...patch };
    await guard(() => adBlockItem.setValue(next));
    return next;
  });
}

/** Save API keys (trimmed). Keys go to storage.local only and never sync. */
export async function saveApiKeys(patch: Partial<ApiKeys>): Promise<ApiKeys> {
  return navigator.locks.request('apiKeys', { mode: 'exclusive' }, async () => {
    const next = { ...(await getApiKeys()) };
    for (const [engine, key] of Object.entries(patch) as [AiEngine, string][]) next[engine] = key.trim();
    await guard(() => apiKeysItem.setValue(next));
    return next;
  });
}
