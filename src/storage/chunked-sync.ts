// Store one JSON value across several chrome.storage.sync items.
//
// A single sync item is capped at 8192 bytes, measured as the UTF-8 length of
// the key plus the JSON serialization of the value. The value is serialized
// once, split into string chunks `<key>__c0..N`, and the chunk count is kept in
// `<key>__chunks`. Each chunk is a JSON string itself, so the budget accounts
// for the escaping Chrome's serializer adds: quotes, backslashes, control chars,
// and, unlike JSON.stringify, '<', U+2028, and U+2029 as \uXXXX.

import { AppError } from '@/src/providers/types';

export const MAX_SYNC_ITEM_BYTES = 8192;

export function chunkCountKey(key: string): string {
  return `${key}__chunks`;
}

export function chunkKey(key: string, index: number): string {
  return `${key}__c${index}`;
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * UTF-8 bytes one UTF-16 code unit takes inside a JSON string literal as Chrome
 * serializes it for the quota check (measured against Chrome 154).
 */
function jsonCharCost(code: number): number {
  if (code === 0x3c || code === 0x2028 || code === 0x2029) return 6; // \u003C, \u2028, \u2029
  if (code === 0x22 || code === 0x5c) return 2; // \" and \\
  if (code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d) return 2; // \b \t \n \f \r
  if (code < 0x20) return 6; // \u00XX
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  // A surrogate pair is 4 UTF-8 bytes in total, 2 per code unit.
  if (code >= 0xd800 && code <= 0xdfff) return 2;
  return 3;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/**
 * Split text so that every chunk fits one sync item under its own chunk key.
 * Boundaries never fall inside a surrogate pair: a lone half would be replaced
 * with U+FFFD when stored and the text could not be reassembled.
 */
export function splitIntoChunks(text: string, key: string, maxItemBytes = MAX_SYNC_ITEM_BYTES): string[] {
  if (text.length === 0) return [''];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    // 2 bytes for the quotes around the serialized chunk.
    const budget = maxItemBytes - utf8Length(chunkKey(key, chunks.length)) - 2;
    let cost = 0;
    let end = start;
    while (end < text.length) {
      const next = jsonCharCost(text.charCodeAt(end));
      if (cost + next > budget) break;
      cost += next;
      end += 1;
    }
    if (end < text.length && end > start && isHighSurrogate(text.charCodeAt(end - 1))) end -= 1;
    if (end === start) throw new AppError('storage-error', 'Sync item budget is too small to hold any text.');
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

/** Wrap a failed browser.storage call (quota, rate limit, ...) as a storage-error. */
export function toStorageError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new AppError('storage-error', message);
}

/**
 * Read a chunked value. Returns null when nothing is stored under `key`.
 * Throws a storage-error when a chunk is missing or the data does not parse.
 */
export async function readChunked<T>(key: string): Promise<T | null> {
  // One snapshot of the whole sync area (100 KB at most), so a concurrent write
  // cannot pair the count of one version with the chunks of another.
  let snapshot: Record<string, unknown>;
  try {
    snapshot = await browser.storage.sync.get(null);
  } catch (error) {
    throw toStorageError(error);
  }
  const count = Number(snapshot[chunkCountKey(key)]) || 0;
  if (count <= 0) return null;

  let serialized = '';
  for (let index = 0; index < count; index += 1) {
    const part = snapshot[chunkKey(key, index)];
    if (typeof part !== 'string') {
      throw new AppError('storage-error', `Sync data "${key}" is missing chunk ${index} of ${count}.`);
    }
    serialized += part;
  }
  try {
    return JSON.parse(serialized) as T;
  } catch {
    throw new AppError('storage-error', `Sync data "${key}" could not be parsed.`);
  }
}

/**
 * Write a value as chunks, then remove every chunk beyond the new count. Stale
 * chunks are found by scanning all stored keys rather than trusting the previous
 * count, so chunks a failed removal left behind are cleaned up on the next write.
 */
export async function writeChunked(key: string, value: unknown): Promise<void> {
  const countKey = chunkCountKey(key);
  const chunks = splitIntoChunks(JSON.stringify(value), key);

  let storedKeys: string[];
  try {
    storedKeys = Object.keys(await browser.storage.sync.get(null));
  } catch (error) {
    throw toStorageError(error);
  }

  const items: Record<string, unknown> = { [countKey]: chunks.length };
  chunks.forEach((chunk, index) => {
    items[chunkKey(key, index)] = chunk;
  });
  try {
    await browser.storage.sync.set(items);
  } catch (error) {
    throw toStorageError(error);
  }

  const prefix = `${key}__c`;
  const stale = storedKeys.filter((stored) => isChunkedKey(key, stored) && stored.startsWith(prefix) && Number(stored.slice(prefix.length)) >= chunks.length);
  if (stale.length > 0) {
    try {
      await browser.storage.sync.remove(stale);
    } catch (error) {
      // The count is already updated, so leftover chunks are never read; the next write retries the removal.
      console.warn('Failed to remove stale sync chunks.', error);
    }
  }
}

/** Whether a changed sync key belongs to the chunked value stored under `key`. */
export function isChunkedKey(key: string, changedKey: string): boolean {
  const prefix = `${key}__c`;
  return changedKey === chunkCountKey(key) || (changedKey.startsWith(prefix) && /^\d+$/.test(changedKey.slice(prefix.length)));
}

/** Call `callback` whenever the chunked value under `key` changes in any window. Returns an unsubscribe function. */
export function watchChunked(key: string, callback: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'sync' && Object.keys(changes).some((changed) => isChunkedKey(key, changed))) callback();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
