// Simple (unchunked) storage items. Personas are larger than one sync item can
// hold and are stored through src/storage/personas.ts instead.

import { DEFAULT_AD_BLOCK, DEFAULT_SETTINGS, EMPTY_API_KEYS, type AdBlockSettings, type ApiKeys, type Settings } from './types';

export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

export const adBlockItem = storage.defineItem<AdBlockSettings>('sync:adBlock', {
  fallback: DEFAULT_AD_BLOCK,
  version: 1,
});

export const activePersonaIdItem = storage.defineItem<string>('sync:activePersonaId', {
  fallback: '',
});

/** Secrets stay on this device. Never move this item to sync. */
export const apiKeysItem = storage.defineItem<ApiKeys>('local:apiKeys', {
  fallback: EMPTY_API_KEYS,
  version: 1,
});

/** Epoch ms when Google free translation was last rate limited; 0 = not cooling down. */
export const googleFreeCooldownAtItem = storage.defineItem<number>('session:googleFreeCooldownAt', {
  fallback: 0,
});

/**
 * Read settings with defaults filled in for any field missing from an older
 * stored object (fallback only applies when the whole item is absent).
 */
export async function getSettings(): Promise<Settings> {
  const stored = await settingsItem.getValue();
  return { ...DEFAULT_SETTINGS, ...stored, models: { ...DEFAULT_SETTINGS.models, ...stored.models } };
}

export async function getApiKeys(): Promise<ApiKeys> {
  return { ...EMPTY_API_KEYS, ...(await apiKeysItem.getValue()) };
}
