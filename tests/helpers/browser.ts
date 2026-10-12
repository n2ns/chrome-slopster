// Test doubles for browser behavior that WXT's fakeBrowser and jsdom lack.

import { vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

export const SYNC_QUOTA_BYTES_PER_ITEM = 8192;

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Bytes Chrome charges for a value: the UTF-8 length of its JSON, where
 * Chromium's serializer (unlike JSON.stringify) escapes '<', U+2028, and
 * U+2029 as six-byte \\uXXXX sequences. Measured in Chrome 154.
 */
export function chromeJsonBytes(value: unknown): number {
  const json = JSON.stringify(value);
  const extra = (json.match(/</g)?.length ?? 0) * 5 + (json.match(/[\u2028\u2029]/g)?.length ?? 0) * 3;
  return utf8Length(json) + extra;
}

/**
 * Make browser.storage.sync.set reject like Chrome when any item's key plus
 * JSON-serialized value exceeds 8192 UTF-8 bytes. fakeBrowser has no quota.
 * Restore with vi.restoreAllMocks().
 */
export function enforceSyncItemQuota() {
  const sync = fakeBrowser.storage.sync;
  const original = sync.set.bind(sync) as (items: Record<string, unknown>) => Promise<void>;
  return vi.spyOn(sync, 'set').mockImplementation((async (items: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(items)) {
      if (utf8Length(key) + chromeJsonBytes(value) > SYNC_QUOTA_BYTES_PER_ITEM) {
        throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
      }
    }
    await original(items);
  }) as never);
}

type LockCallback = (lock: { name: string; mode: string }) => unknown;

/** Install an exclusive, FIFO navigator.locks when the environment has none (jsdom). */
export function installLocksPolyfill(): void {
  if ('locks' in navigator && navigator.locks) return;
  const tails = new Map<string, Promise<unknown>>();
  const locks = {
    request(name: string, optionsOrCallback: object | LockCallback, maybeCallback?: LockCallback) {
      const callback = (typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback)!;
      const previous = tails.get(name) ?? Promise.resolve();
      const result = previous.then(() => callback({ name, mode: 'exclusive' }));
      tails.set(
        name,
        result.catch(() => undefined),
      );
      return result;
    },
  };
  // navigator.locks may be a read-only getter, so define rather than assign.
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
}

/** Make t() return the message key, since fakeBrowser does not implement i18n. */
export function mockI18n() {
  return vi.spyOn(fakeBrowser.i18n, 'getMessage').mockImplementation(((key: string) => key) as never);
}
