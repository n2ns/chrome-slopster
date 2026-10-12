import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { AppError } from '@/src/providers/types';
import {
  chunkCountKey,
  chunkKey,
  MAX_SYNC_ITEM_BYTES,
  readChunked,
  splitIntoChunks,
  watchChunked,
  writeChunked,
} from '@/src/storage/chunked-sync';
import { enforceSyncItemQuota } from './helpers/browser';

const KEY = 'data';
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

async function syncSnapshot(): Promise<Record<string, unknown>> {
  return fakeBrowser.storage.sync.get(null);
}

function itemBytes(key: string, value: unknown): number {
  const encoder = new TextEncoder();
  return encoder.encode(key).length + encoder.encode(JSON.stringify(value)).length;
}

describe('chunked sync storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    enforceSyncItemQuota();
  });
  afterEach(() => vi.restoreAllMocks());

  it('the quota helper rejects an oversized single item', async () => {
    await expect(browser.storage.sync.set({ big: 'x'.repeat(MAX_SYNC_ITEM_BYTES) })).rejects.toThrow('QUOTA_BYTES_PER_ITEM');
  });

  it('returns null when nothing is stored', async () => {
    await expect(readChunked(KEY)).resolves.toBeNull();
  });

  it('round-trips a small value in one chunk', async () => {
    const value = { a: 1, list: ['x', 'y'], nested: { ok: true } };
    await writeChunked(KEY, value);
    expect((await syncSnapshot())[chunkCountKey(KEY)]).toBe(1);
    await expect(readChunked(KEY)).resolves.toEqual(value);
  });

  it('round-trips large multi-byte, emoji, and escaped text within the per-item quota', async () => {
    const pieces = ['a', '中', '😀', '"', '\\', '\n', '\u0001', 'é', '👩‍👩‍👧'];
    const text = Array.from({ length: 12000 }, (_, i) => pieces[(i * 7) % pieces.length]).join('');
    const value = { text };
    await writeChunked(KEY, value);

    const snapshot = await syncSnapshot();
    const count = snapshot[chunkCountKey(KEY)] as number;
    expect(count).toBeGreaterThan(3);
    for (let index = 0; index < count; index += 1) {
      const chunk = snapshot[chunkKey(KEY, index)] as string;
      expect(itemBytes(chunkKey(KEY, index), chunk)).toBeLessThanOrEqual(MAX_SYNC_ITEM_BYTES);
      expect(chunk).not.toMatch(LONE_SURROGATE);
    }
    await expect(readChunked(KEY)).resolves.toEqual(value);
  });

  it.each(Array.from({ length: 8 }, (_, offset) => offset))('never splits a surrogate pair (ASCII offset %i)', (offset) => {
    const text = 'a'.repeat(offset) + '😀'.repeat(5000);
    const chunks = splitIntoChunks(text, KEY);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(text);
    chunks.forEach((chunk, index) => {
      expect(chunk).not.toMatch(LONE_SURROGATE);
      expect(itemBytes(chunkKey(KEY, index), chunk)).toBeLessThanOrEqual(MAX_SYNC_ITEM_BYTES);
    });
  });

  it('fills chunks up to the exact byte limit', () => {
    const chunks = splitIntoChunks('b'.repeat(20000), KEY);
    expect(itemBytes(chunkKey(KEY, 0), chunks[0])).toBe(MAX_SYNC_ITEM_BYTES);
  });

  it('removes stale higher chunks after the value shrinks', async () => {
    await writeChunked(KEY, 'z'.repeat(20000));
    expect((await syncSnapshot())[chunkCountKey(KEY)]).toBe(3);

    await writeChunked(KEY, 'small');
    const snapshot = await syncSnapshot();
    expect(snapshot[chunkCountKey(KEY)]).toBe(1);
    expect(snapshot).not.toHaveProperty(chunkKey(KEY, 1));
    expect(snapshot).not.toHaveProperty(chunkKey(KEY, 2));
    await expect(readChunked(KEY)).resolves.toBe('small');
  });

  it('throws storage-error when a chunk is missing instead of parsing truncated JSON', async () => {
    await writeChunked(KEY, { text: 'q'.repeat(20000) });
    await fakeBrowser.storage.sync.remove(chunkKey(KEY, 1));
    const error = await readChunked(KEY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'storage-error' });
  });

  it('throws storage-error when the stored data does not parse', async () => {
    await fakeBrowser.storage.sync.set({ [chunkCountKey(KEY)]: 1, [chunkKey(KEY, 0)]: '{"broken' });
    await expect(readChunked(KEY)).rejects.toMatchObject({ code: 'storage-error' });
  });

  it.each(['QUOTA_BYTES quota exceeded', 'MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded'])(
    'surfaces a write failure (%s) as storage-error',
    async (message) => {
      vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValue(new Error(message));
      const error = await writeChunked(KEY, { a: 1 }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ code: 'storage-error', message });
    },
  );

  it('notifies watchers only for its own keys', async () => {
    const callback = vi.fn();
    const unwatch = watchChunked(KEY, callback);
    await fakeBrowser.storage.sync.set({ other: 1, [`${KEY}x__c0`]: 'nope' });
    expect(callback).not.toHaveBeenCalled();
    await writeChunked(KEY, [1, 2]);
    expect(callback).toHaveBeenCalled();
    unwatch();
    callback.mockClear();
    await writeChunked(KEY, [3]);
    expect(callback).not.toHaveBeenCalled();
  });
});
